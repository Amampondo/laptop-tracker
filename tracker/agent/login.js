const btn   = document.getElementById('btn')
const error = document.getElementById('error')

async function handleLogin() {
  const email    = document.getElementById('email').value.trim()
  const password = document.getElementById('password').value
  error.textContent = ''

  if (!email || !password) {
    error.textContent = 'Please enter email and password'
    return
  }

  btn.disabled    = true
  btn.textContent = 'Signing in...'

  try {
    await window.tracker.login(email, password)
  } catch (e) {
    error.textContent = e.message || 'Invalid email or password'
    btn.disabled    = false
    btn.textContent = 'Sign in'
  }
}

btn.addEventListener('click', handleLogin)

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleLogin()
})