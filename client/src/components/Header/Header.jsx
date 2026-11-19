import { NavLink } from "react-router-dom";
import "./Header.css";

function Header({ user, onLogout }) {
  return (
    <header className="header">
      <NavLink to="/" className="header-brand">
        GameSphere
      </NavLink>

      <nav className="header-nav">
        <NavLink to="/">Feed</NavLink>
        <NavLink to="/games">Games</NavLink>
        <NavLink to="/profile">Profile</NavLink>
      </nav>

      <div className="header-user">
        <span>
          {user.firstName} {user.lastName}
        </span>

        <button type="button" onClick={onLogout}>
          Sign Out
        </button>
      </div>
    </header>
  );
}

export default Header;
