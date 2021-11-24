# WIP

# TL;DR Setup

## Installing
```sh
git clone https://github.com/cyrus01337/logging.git
cd ./logging
npm i
```

## Starting
```sh
npm start
```

## Altogether
```sh
git clone https://github.com/cyrus01337/logging.git
cd ./logging
npm i
npm start
```

## Using
Logging.start heehee format parameter hoohoo


# What is this?
`logging` (for lack of a better name) is a proxy webserver that stores chat logs sent to it and dumps them to a Discord webhook in bulk when requested. This is done in such a way that it respects webhook ratelimits and offloads chat message saving and dumping to the webserver. This means that the game servers get more resources for everything else and, thanks to the webserver handling the creation of chat log files, maximises the time for extra logic to run when using `game:BindToClose`.

## Request Schema
Message object (for sending single messages):
```ts
{
    code: str,
    player: str,
    content: str,
    time: int
}
```

Bulk message request (for sending multiple messages at once):
```ts
{
    code: str,
    messages: Message[]
}
```

## Configuration
```sh
# run the application on the following port...
PORT=3000

# ...
INTERVAL=10

# login credentials for the PostgreSQL database...
PASS=postgres
USER=postgres
```
