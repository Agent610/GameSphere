import { useEffect, useState } from "react";
import Login from "../../pages/Login/Login.jsx";
import Register from "../../pages/Register/Register.jsx";
import "./App.css";
import apiRequest from "../../utils/api.js";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";

function App() {
  const [currentPage, setCurrentPage] = useState("login");
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    async function restoreSession() {
      const token = localStorage.getItem("token");

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await apiRequest("/api/auth/me");
        setUser(data.user);
      } catch (error) {
        localStorage.removeItem("token");
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  async function handleRegister(event) {
    event.preventDefault();

    const formData = Object.fromEntries(new FormData(event.target));

    const { firstName, lastName, platform, email, password } = formData;

    try {
      const data = await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          firstName,
          lastName,
          platform,
          email,
          password,
        }),
      });

      localStorage.setItem("token", data.token);
      setUser(data.user);

      setMessage("Account created successfully!");
      navigate("/");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();

    const formData = Object.fromEntries(new FormData(event.target));

    const { name, password } = formData;

    try {
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          name,
          password,
        }),
      });

      localStorage.setItem("token", data.token);
      setUser(data.user);
      setMessage("Welcome back!");
      navigate("/");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    setUser(null);
    setMessage("");
    navigate("/login");
  }

  if (loading) {
    return <p>Loading your profile...</p>;
  }

  return (
    <div className="app">
      {message && (
        <p className="app-message" role="alert">
          {message}
        </p>
      )}
      <Routes>
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/" replace />
            ) : (
              <Login
                onLogin={handleLogin}
                onCreateAccount={() => {
                  setMessage("");
                  navigate("/register");
                }}
              />
            )
          }
        />
        <Route
          path="/register"
          element={
            user ? (
              <Navigate to="/" replace />
            ) : (
              <Register
                onRegister={handleRegister}
                onBackToLogin={() => {
                  setMessage("");
                  navigate("/login");
                }}
              />
            )
          }
        />
        <Route
          path="/"
          element={
            user ? (
              <main>
                <h1>Welcome to GameSphere, {user.firstName}!</h1>
                <p>You are now successfully signed in.</p>
                <button onClick={handleLogout}>Sign Out</button>
              </main>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="*"
          element={<Navigate to={user ? "/" : "/login"} replace />}
        />
      </Routes>
    </div>
  );
}

export default App;
