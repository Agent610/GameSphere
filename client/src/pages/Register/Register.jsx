import "./Register.css";

function Register({ onBackToLogin, onRegister }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark" aria-hidden="true">
          GameSphere
        </div>

        <h1>Join GameSphere</h1>
        <p className="auth-subtitle">
          Create your account and start your next adventure.
        </p>

        <h2>Create account</h2>

        <form onSubmit={onRegister}>
          <label htmlFor="first-name">First Name</label>
          <input
            id="first-name"
            name="firstName"
            type="text"
            placeholder="First Name"
            autoComplete="Name"
            required
          />

          <label htmlFor="last-name">Last Name</label>
          <input
            id="last-name"
            name="lastName"
            type="text"
            placeholder="Last Name"
            autoComplete="Name"
            required
          />

          <label htmlFor="platform">Platform</label>
          <select id="platform" name="platform" defaultValue="" required>
            <option value="" disabled>
              Choose your platform
            </option>
            <option value="PlayStation">PlayStation</option>
            <option value="Xbox">Xbox</option>
            <option value="Nintendo">Nintendo</option>
            <option value="PC">PC</option>
            <option value="Mobile">Mobile</option>
          </select>

          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            name="email"
            type="email"
            placeholder="Email@email.com"
            autoComplete="email"
            required
          />

          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            name="password"
            type="password"
            placeholder="Create your password"
            autoComplete="password"
            minLength={8}
            required
          />

          <button className="auth-button" type="submit">
            Create Account
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{""}
          <button type="button" className="text-button" onClick={onBackToLogin}>
            Sign In
          </button>
        </p>
      </section>
    </main>
  );
}

export default Register;
