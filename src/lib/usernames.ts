const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._]{1,22}[a-z0-9])?$/;

export function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export function validateUsername(value: string) {
  const username = normalizeUsername(value);
  if (username.length < 3 || username.length > 24) {
    return { username, error: "Use 3–24 characters." };
  }
  if (!USERNAME_PATTERN.test(username) || username.includes("..")) {
    return { username, error: "Use letters, numbers, dots, or underscores; start and end with a letter or number." };
  }
  return { username, error: null };
}
