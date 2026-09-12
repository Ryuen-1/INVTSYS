import { useState } from 'react'

import { useAuth } from './AuthContext'

export function LoginForm() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await signIn(email, password)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Login failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-shell">
        <aside className="login-intro">
          <div className="login-brand">
            <span className="brand-mark" aria-hidden="true">IS</span>
            <span>Inventory System</span>
          </div>
          <div className="login-message">
            <p className="eyebrow">Operations, in order</p>
            <h1>Everything your inventory needs, in one place.</h1>
            <p>Keep products, stock, suppliers, and branches moving with confidence.</p>
          </div>
          <div className="login-intro-footer">
            <span className="intro-rule" aria-hidden="true" />
            <span>Built for teams that keep things moving.</span>
          </div>
        </aside>

        <form className="login-panel" onSubmit={handleSubmit}>
          <div className="login-heading">
            <p className="eyebrow">Welcome back</p>
            <h2>Sign in to your workspace</h2>
            <p>Enter your details to continue.</p>
          </div>
          <label>
            Email address
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
              type="password"
              value={password}
            />
          </label>
          {errorMessage && <p className="form-error">{errorMessage}</p>}
          <button disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Signing in...' : 'Continue'}
            {!isSubmitting && <span aria-hidden="true">&#8594;</span>}
          </button>
        </form>
      </section>
    </main>
  )
}
