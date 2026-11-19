import "./Footer.css";

function Footer() {
  const contributors = [
    "Devin Bhavsar",
    "Alejandro Jimenez",
    "Matthew Richards",
    "John Siordia",
  ];

  return (
    <footer className="footer">
      <p className="footer-title">GameSphere</p>
      <p className="footer-credit">Created by</p>
      <ul className="footer-contributors">
        {contributors.map((contributor) => (
          <li key={contributor}>{contributor}</li>
        ))}
      </ul>

      <p className="footer-copyright">
        © {new Date().getFullYear()} GameSphere. All rights reserved.
      </p>
    </footer>
  );
}

export default Footer;
