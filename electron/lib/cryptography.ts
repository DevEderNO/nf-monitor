import crypto from "crypto";
const initialization_vector = "X05IGQ5qdBnIqAWD";

export function encrypt(text: string) {
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(import.meta.env.VITE_PASSWORD_SECRET),
    Buffer.from(initialization_vector)
  );
  let crypted = cipher.update(text, "utf8", "hex");
  crypted += cipher.final("hex");
  return crypted;
}

export function decrypt(text: string) {
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(import.meta.env.VITE_PASSWORD_SECRET),
    Buffer.from(initialization_vector)
  );
  let dec = decipher.update(text, "hex", "utf8");
  dec += decipher.final("utf8");
  return dec;
}
