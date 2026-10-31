import { useState } from "react";
import Login from "../../pages/Login/Login.jsx";
import Register from "../../pages/Register/Register.jsx";
import "./App.css";

function App() {
  const [currentPage, setCurrentPage] = useState("login");
  const [message, setMessage] = useState("");

  function handleLogin(event) {
    event.preventDefault();

    setMessage("Login form validated.");
  }

  function handleRegister(event) {
    event.preventDefault();

    setMessage("Registration form validated.");
  }

  function navigateTo(page) {
    setMessage("");
    setCurrentPage(page);
  }

  return (
    <div className="app">
      {currentPage === "login" ? (
        <Login
          onLogin={handleLogin}
          onCreateAccount={() => navigateTo("register")}
        />
      ) : (
        <Register
          onRegister={handleRegister}
          onBackToLogin={() => navigateTo("login")}
        />
      )}

      {message && (
        <p className="app-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}

export default App;
