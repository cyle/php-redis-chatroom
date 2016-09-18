# PHP/JS/Redis API Spec

The PHP side of this chatroom proof of concept has a very simple API:

## Getting Messages

A really simple endpoint for getting all messages sent to a given chatroom since a given timestamp.

### Request

`GET chatroom.php`

Query parameters:

- `where` : `String` - The chatroom name to fetch messages from. Must not be empty.
- `since` : `Float` - A millisecond-precision unix epoch timestamp, the endpoint will return any messages sent AFTER this timestamp. If 0, returns nothing except a valid empty response to kick things off.

### Response

On a `200 OK` server response, the server will send back an object with three keys:

- `ok` : `Boolean` - Whether or not your request succeeded.
- `ts` : `Float` - A millisecond-precision unix epoch timestamp of when this request was executed; clients should use this for their next "get messages" request's `since` query parameter.
- `data` : `Array` - An array of message objects, in order of when they were posted to the channel. See below for details.

The server may return a `500 Server Internal Error` message if anything goes wrong. Ideally this would be better but this is just a proof of concept.

## Sending Messages

Another really simple endpoint for posting a message to a chatroom. There's no security checks in here so you could spoof a lot if you wanted.

### Request

`POST chatroom.php`

POST url-encoded body parameters:

- `where` : `String` - The chatroom to post a message to. Must not be empty.
- `who` : `String` - The username you're posting a message as. Must not be empty.
- `message` : `String` - The message you'd like to post in the chatroom. Must not be empty.

### Response

On a `200 OK` server response, the server will send back an object with two keys:

- `ok` : `Boolean` - Whether or not your request succeeded.
- `data` : `Object` - The message object as the server accepted it, so the client can display it as well if it wants.

The server may return a `500 Server Internal Error` message if anything goes wrong. Ideally this would be better but this is just a proof of concept.

## The Message Object

When getting and sending messages, you'll get message objects that always follow this format:

- `w` : `String` - Who sent the message.
- `m` : `String` - The message text itself.
- `ts` : `Float` - The unix epoch timestamp of when the message was sent, with at least millisecond precision.

That's it!
