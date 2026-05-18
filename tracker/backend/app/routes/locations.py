from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from geoalchemy2.shape import to_shape, from_shape
from geoalchemy2.elements import WKBElement
from shapely.geometry import Point
from shapely import wkb
from typing import List, Optional
from datetime import datetime, timezone
from ..core.database import get_db
from ..core.auth import require_any_role, require_manager_or_above
from ..models.location import LocationEvent
from ..models.user import User
from ..schemas import LocationIn, LocationOut, UserWithLatestLocation, LocationHistoryOut, UserOut

router = APIRouter(prefix="/locations", tags=["locations"])


def _point_to_latlon(point_col):
    """
    Safely extract (lat, lon) from a PostGIS point column.
    Handles both geoalchemy2 WKBElement and raw hex WKB strings
    that come back after a db.refresh().
    Always returns (latitude, longitude) — never swapped.
    """
    if isinstance(point_col, WKBElement):
        pt = to_shape(point_col)
    elif isinstance(point_col, (str, bytes)):
        pt = wkb.loads(point_col, hex=isinstance(point_col, str))
    else:
        # fallback
        pt = to_shape(point_col)
    # PostGIS POINT(longitude latitude) → shapely Point(x=lng, y=lat)
    return pt.y, pt.x   # lat, lon


def _event_to_out(ev: LocationEvent) -> LocationOut:
    lat, lon = _point_to_latlon(ev.point)
    return LocationOut(
        id=ev.id,
        user_id=ev.user_id,
        latitude=lat,
        longitude=lon,
        accuracy_metres=ev.accuracy_metres,
        recorded_at=ev.recorded_at,
        received_at=ev.received_at,
    )


def _normalise_dt(dt: datetime) -> datetime:
    """Ensure datetime is timezone-aware (UTC). Treats naive datetimes as UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


@router.post("/", response_model=LocationOut)
def post_location(
    body: LocationIn,
    db: Session = Depends(get_db),
    current_user=Depends(require_any_role),
):
    """Called by the agent every 5 minutes."""
    point = from_shape(Point(body.longitude, body.latitude), srid=4326)
    event = LocationEvent(
        user_id=current_user.id,
        point=point,
        accuracy_metres=body.accuracy_metres,
        recorded_at=_normalise_dt(body.recorded_at),
    )
    db.add(event)
    db.commit()

    # Re-query instead of refresh so PostGIS deserialises the point correctly
    event = db.query(LocationEvent).filter(LocationEvent.id == event.id).first()
    return _event_to_out(event)


@router.get("/map/{org_id}", response_model=List[UserWithLatestLocation])
def map_view(
    org_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager_or_above),
):
    """Returns each user in the org with their most recent location — for the map view."""
    if current_user.role == "manager" and str(current_user.organisation_id) != org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    users = db.query(User).filter(
        User.organisation_id == org_id,
        User.is_active == True,
    ).all()

    result = []
    for user in users:
        latest = (
            db.query(LocationEvent)
            .filter(LocationEvent.user_id == user.id)
            .order_by(desc(LocationEvent.recorded_at))
            .first()
        )
        result.append(UserWithLatestLocation(
            user=UserOut.model_validate(user),
            latest=_event_to_out(latest) if latest else None,
        ))
    return result


@router.get("/history/{user_id}", response_model=LocationHistoryOut)
def location_history(
    user_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_any_role),
    from_dt: Optional[datetime] = Query(None),
    to_dt:   Optional[datetime] = Query(None),
    limit:   int = Query(500, le=2000),
):
    """Returns ordered location history for replay. Filterable by time range."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user.role == "user" and str(current_user.id) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.role == "manager" and str(target.organisation_id) != str(current_user.organisation_id):
        raise HTTPException(status_code=403, detail="Access denied")

    q = db.query(LocationEvent).filter(LocationEvent.user_id == user_id)
    if from_dt:
        q = q.filter(LocationEvent.recorded_at >= _normalise_dt(from_dt))
    if to_dt:
        q = q.filter(LocationEvent.recorded_at <= _normalise_dt(to_dt))

    events = q.order_by(LocationEvent.recorded_at).limit(limit).all()
    return LocationHistoryOut(user_id=user_id, points=[_event_to_out(e) for e in events])


@router.delete("/history/{user_id}", status_code=200)
def delete_location_history(
    user_id: str,
    from_dt: datetime = Query(..., description="Start of range to delete (inclusive)"),
    to_dt:   datetime = Query(..., description="End of range to delete (inclusive)"),
    db: Session = Depends(get_db),
    current_user=Depends(require_manager_or_above),
):
    """Delete location history for a user within a date range."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user.role == "manager" and str(target.organisation_id) != str(current_user.organisation_id):
        raise HTTPException(status_code=403, detail="Access denied")

    deleted = (
        db.query(LocationEvent)
        .filter(
            LocationEvent.user_id == user_id,
            LocationEvent.recorded_at >= _normalise_dt(from_dt),
            LocationEvent.recorded_at <= _normalise_dt(to_dt),
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"deleted": deleted}
