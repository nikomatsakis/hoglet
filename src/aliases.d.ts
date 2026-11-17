declare module "socket.io-client-v2" {
  import { Socket } from "socket.io-client";
  const io: (url: string, options: Record<string, unknown>) => Socket;
  export default io;
}
declare module "socket.io-v2" {
  const io: (server: import("node:http").Server, options: Record<string, unknown>) => any;
  export default io;
}
