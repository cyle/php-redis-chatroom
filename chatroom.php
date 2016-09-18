<?php

/**
 * Chatroom PHP backend crap.
 *
 * There are basically two routes here:
 *   1. Getting messages based on chatroom name and an "after" filter timestamp.
 *   2. Posting a new message to a chatroom.
 *
 * Messages are stored in Redis ordered/ranked sets, with the key being a hash of the chatroom name
 * and the score being a timetamp with microsecond precision. That way messages are kept in order and
 * they can be fetched really quickly on a per-chatroom basis. There's really no more intelligence than
 * that.
 *
 * Missing stuff: no username validation/authentication, a lot of security holes probbaly.
 */

// everything is handled by redis, so let's rev it up
$redis = new Redis(); // this is the php-redis library
$redis->connect('127.0.0.1', 6379); // assuming redis is running locally using the standard port

/**
 * A real simple class to encapsulate our chatroom functionality.
 */
class Chatroom {
    /**
     * Our redis connection.
     * @var Redis
     */
    private $redis;

    /**
     * The redis key for the chatroom being used.
     * @var string
     */
    private $redis_chatroom_key;

    /**
     * Only keep this many messages in the sorted set per chatroom.
     * @var int
     */
    private $messages_to_keep = 100;

    /**
     * Construct a new instance of this chatroom.
     * @param Redis $redis The redis instance to use
     * @param string $where The chatroom name, or whatever unique string identifier you want really
     * @return Chatroom
     */
    public function __construct(Redis $redis, string $where) {
        $this->redis = $redis;
        $where = trim(strip_tags($where)); // let's make sure we're not dealing with any bullshit
        if ($where === '') {
            throw new InvalidArgumentException('chatroom name cannot be empty');
        }
        $this->set_where($where);
    }

    /**
     * Get all messages for a place since a certain timestamp.
     * This will return an object with keys `ok`, `ts`, and `data`.
     *   - `ok` just means "yeah this worked" or not
     *   - `ts` is the timestamp the client should store and use for their next "get messages" call
     *   - `data` should be an array of new messages the client doesn't have yet
     *
     * @param int $since_when A millisecond-precision unix timestamp, will fetch messages that happened AFTER this timestamp
     * @return array A response associative array with keys `ok`, `ts`, and `data`
     */
    public function get_messages(int $since_when):array {
        $since_when = $since_when / 1000;

        if ($since_when <= 0) {
            // send back nothing if we were given some weird input
            return [
                'ok' => true,
                'ts' => round(microtime(true) * 1000) / 1000, // formatted for the client
                'data' => [], // nothing
            ];
        }

        // fetch the messages from redis
        $chatroom_data = $this->redis->zrangebyscore($this->redis_chatroom_key, $since_when, '+inf');

        if (empty($chatroom_data)) {
            // we got nothin back, oh well
            return [
                'ok' => true,
                'ts' => round(microtime(true) * 1000) / 1000, // formatted for the client
                'data' => [], // nothing
            ];
        }

        $messages = []; // will hold our deserialized messages
        foreach ($chatroom_data as $encoded_message) {
            // unserialize the messages from redis storage
            $messages[] = unserialize($encoded_message, [
                'allowed_classes' => false, // no classes may be used. security? haha.
            ]);
        }

        // send back the new messages
        return [
            'ok' => true,
            'ts' => round(microtime(true) * 1000) / 1000, // formatted for the client
            'data' => $messages,
        ];
    }

    /**
     * Send a message as the given person.
     *
     * @param string $who The username the client is giving us; normally I'd do better than this.
     * @param string $message The message to send.
     * @return array An associative array with keys `ok` and `data`, in this case `data` is the accepted message object
     */
    public function send_message(string $who, string $message):array {
        // sanitize our inputs
        $who = trim(strip_tags($who));
        $message = trim(strip_tags($message));
        if ($who === '' || $message === '') {
            throw new InvalidArgumentException('None of the send message arguments can be empty.');
        }

        // we'll be storing the message based on when it was sent
        $new_message_ts = microtime(true);

        // the data we'll store in redis
        $message_data = [
            'w' => $who,
            'ts' => $new_message_ts,
            'm' => $message,
        ];

        // serialize + save to redis
        $encoded_message_data = serialize($message_data);
        $this->redis->zadd($this->redis_chatroom_key, $new_message_ts, $encoded_message_data);

        // only keep the latest X messages in redis
        $this->redis->zremrangebyrank($this->redis_chatroom_key, 0, (-1 * ($this->messages_to_keep + 1)));
        // could also zremrangebyscore here if you wanted to have a TTL on messages

        // send back that we got the message and it was stored just fine
        return [
            'ok' => true,
            'data' => $message_data,
        ];
    }

    /**
     * Set the redis key for this chatroom name.
     * @param string $where The chatroom name, could be anything as long as it's a string
     * @return void
     */
    private function set_where(string $where) {
        $this->redis_chatroom_key = 'chat-' . sha1($where);
    }
}

/*

    do our dumb routing -- either we're getting messages or we're sending a message

    this could be way better, it's really dumb and simple right now

*/
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // getting messages
    $chatroom = new Chatroom($redis, $_GET['where']);
    $response_data = $chatroom->get_messages($_GET['since']);
} else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // posting a new message somewhere
    $chatroom = new Chatroom($redis, $_POST['where']);
    $response_data = $chatroom->send_message($_POST['who'], $_POST['message']);
} else {
    // default to a failure case
    $response_data = [
        'ok' => false,
        'message' => 'lol i dunno',
    ];
}

// send back some goddamn JSON
echo json_encode($response_data);
