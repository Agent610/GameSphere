import "./Register.css";

function Register({ onBackToLogin, onRegister }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark" aria-hidden="true">
          GS
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
            placeholder="First name"
            autoComplete="Name"
            required
          />
        </form>
      </section>
    </main>
  );
}
