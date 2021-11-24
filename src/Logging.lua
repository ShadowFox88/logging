local HTTP = game:GetService("HttpService")
local Players = game:GetService("Players")

local URL = "localhost:8080"
local Logging = {
    Code = nil,
    Connection = nil,
    Format = nil,
    Bound = false,
    Buffer = {}
}


function Logging.authenticate()
    local url = string.format("%s/api/authenciate", URL)
    local data = {
        Code = Logging.Code,
        Format = Logging.Format
    }
    local success, messageOrCode = pcall(HTTP.PostAsync, HTTP, url, data, Enum.HttpContentType.ApplicationJson)

    if success then
        return messageOrCode
    end

    error(messageOrCode)
end


function Logging.checksum(message, speaker)
    -- function that determines whether a message should be logged depending on
    -- it's return value - put whatever you want here

    -- returning true will log the message
    -- returning false will ignore it
    return true
end


function Logging.callback(message, speaker)
    if not Logging.Connection or Logging.checksum(message, speaker) then return end

    local url = string.format("%s/api/log", URL)
    local data = {
        Code = Logging.Code,
        Content = message,
        Player = speaker.Name,
        Time = time()
    }
    local success, message = pcall(HTTP.PostAsync, HTTP, url, data, Enum.HttpContentType.ApplicationJson)

    if not success then
        error(message)
    end
end


function Logging.dump()
    if not Logging.Connection then return end

    local url = string.format("%s/api/dump", URL)
    local data = {
        Code = Logging.Code
    }
    local success, message = pcall(HTTP.PostAsync, HTTP, url, data, Enum.HttpContentType.ApplicationJson)

    if not success then
        error(message)
    end
end


local function onPlayerAdded(player)
    player.Chatted:Connect(Logging.callback)
end


function Logging.start(format)
    Logging.Format = format
    local messageOrCode;

    if not Logging.Code then
        local success;
        success, messageOrCode = pcall(Logging.authenticate)

        if not success then
            error(messageOrCode)
        end
    end

    print(messageOrCode)

    Logging.Code = if Logging.Code then Logging.Code else messageOrCode

    for _, player in ipairs(Players:GetPlayers()) do
        onPlayerAdded(player)
    end

    Logging.Connection = Players.PlayerAdded:Connect(onPlayerAdded)

    if not Logging.Bound then
        game:BindToClose(Logging.dump)
    end
end


function Logging.stop()
    Logging.Connection:Disconnect()

    Logging.Connection = nil
end


function Logging.reset()
    Logging.Code = nil
end


return Logging
