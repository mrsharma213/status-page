import "server-only";
import { envFrom, type AppEnv } from "../env";

export function currentEnv(): AppEnv {
  return envFrom(process.env);
}
