import connectLivereload from "connect-livereload";
import livereload from "livereload";


export default function(port=8080) {
    let livereloadServer = livereload.createServer({ port: process.env.PORT || port });


    livereloadServer.server.once("connection", () => setTimeout(() => livereloadServer.refresh("/"), 100));


    return connectLivereload();
}
