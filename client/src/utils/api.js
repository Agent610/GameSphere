const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    ...options.headers,
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const data = await response.json();

    const error = new Error(data.error.message);
    error.code = data.error.code;

    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export default apiRequest;
