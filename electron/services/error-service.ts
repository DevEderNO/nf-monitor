import { ErrorType } from "@prisma/client";
import { addError } from "./database";

export async function logError(error: Error, type: ErrorType) {
  try {
    const errorData = {
      message: error.message,
      stack: error.stack || "",
      type: type ?? ErrorType.Others,
      date: new Date(),
    };

    await addError(errorData);
    console.error("Error logged:", errorData);
  } catch (err) {
    console.error("Failed to log error:", err);
  }
}
