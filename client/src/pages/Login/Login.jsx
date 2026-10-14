"import ./Login.css";

function Login({ onCreateAccount, onLogin }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark" aria-hidden="true">
          GS
        </div>

        <h1>GameSphere</h1>
        <p className="auth-subtitle">Your gaming journey starts here.</p>

        <h2>Welcome back</h2>
        <p className="form-description">Sign in to your account.</p>

        <form onSubmit={onLogin}>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            name="name"
            type="email"
            placeholder="Email"
            autoComplete="email"
            required
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />

          <button className="auth-button" type="submit">
            Sign In
          </button>
        </form>

        <p className="auth-switch">
          No account ? {""}
          <button
            type="button"
            className="text-button"
            onClick={onCreateAccount}
          >
            Create one
          </button>
        </p>
      </section>
    </main>
  );
}

export default Login;
