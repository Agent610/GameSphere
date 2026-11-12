import "./Register.css";

function Register({ onBackToLogin, onRegister }) {
  const platforms = ["PlayStation", "Xbox", "Nintendo", "PC", "Mobile"];

  function handleSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const primaryPlatform = formData.get("platform");
    const secondPlatform = formData.get("secondPlatform");

    onRegister(event);
  }

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

        <form onSubmit={handleSubmit}>
          <label htmlFor="first-name">First Name</label>
          <input
            id="first-name"
            name="firstName"
            type="text"
            placeholder="First Name"
            autoComplete="given-name"
            required
          />

          <label htmlFor="last-name">Last Name</label>
          <input
            id="last-name"
            name="lastName"
            type="text"
            placeholder="Last Name"
            autoComplete="family-name"
            required
          />

          <label htmlFor="platform">Primary Platform</label>
          <select id="platform" name="platform" defaultValue="" required>
            <option value="" disabled>
              Choose your main platform
            </option>

            {platforms.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>

          <label htmlFor="second-platform">Second Platform (Optional)</label>

          <select id="second-platform" name="secondPlatform" defaultValue="">
            <option value="">Choose another platform (Optional)</option>

            {platforms.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>

          <p className="platform-hint">
            Play on more than one platform? Add another one here.
          </p>

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
            autoComplete="new-password"
            minLength={8}
            required
          />

          <button className="auth-button" type="submit">
            Create Account
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <button type="button" className="text-button" onClick={onBackToLogin}>
            Sign In
          </button>
        </p>
      </section>
    </main>
  );
}

export default Register;
