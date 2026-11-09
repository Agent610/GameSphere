export function getAllUsers(request, response) {
  return response.send("GET ALL USERS");
}

export function getUserById(request, response) {
  return response.send("GET USER BY ID");
}

export function signup(request, response) {
  return response.send("SIGNUP USER");
}

export function login(request, response) {
  return response.send("LOGIN USER");
}

export function updateProfile(request, response) {
  response.send("UPDATE USER PROFILE");
}

export function deleteAccount(request, response) {
  response.send("DELETE USER ACCOUNT");
}
