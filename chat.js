/*

    whoa chatroom

*/

// some global state to keep track of
var username; // the current user's name
var chatroom; // the current chatroom the user is in
var last_checkin = 0; // usually server-controlled, but gotta start somewhere
var checking_for_new_messages; // the interval itself will be held here
var checkin_interval = 1000; // how often to poll for new messages
var messages = []; // a real simple hashmap of messages for client-side deduplication

// DOM elements that'll be useful
var compose_input;
var chatroom_container;
var messages_container;

// on window load, do a bunch of stuff
window.onload = function() {
    // get their username
    while (username === undefined || username.trim() === '') {
        username = prompt('hey whats ur name lol');
    }

    // get whatever chatroom you wanna be in
    while (chatroom === undefined || chatroom.trim() === '') {
        chatroom = prompt('and where u wanna chat?', 'lobby');
    }

    // display the chatroom name
    document.getElementById('chatroom-name').innerHTML = chatroom;

    // grab those useful DOM elements
    messages_container = document.getElementById('messages-list');
    chatroom_container = document.getElementById('chatroom-container');
    compose_input = document.getElementById('chat-compose-input');

    // for the new message compose input, listen for that ENTER button
    compose_input.addEventListener('keyup', function(e) {
        if (e.keyCode === 13) {
            // enter key! send message
            send_message();
        }
    });

    // ello, show a fake "intro" message i guess
    add_message_with_data({
        w: 'bot',
        m: 'welcome to the chatroom thing, ' + username,
        ts: (Date.now() / 1000),
    });

    // start polling for new messages
    checking_for_new_messages = setInterval(get_messages, checkin_interval);
    get_messages();

    // focus the message compose input field
    compose_input.focus();
}

/**
 * Send a message. Not broken apart at all, it's all just shoved in here.
 */
function send_message() {
    var message = compose_input.value;

    // make sure we actually have a message
    if (message === undefined || message.trim() === '') {
        return; // nah
    }

    // ajax call to the server
    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'chatroom.php');
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.onload = function() {
        if (xhr.status === 200) {
            var response_obj = JSON.parse(xhr.responseText);
            if (response_obj.ok === undefined || response_obj.ok !== true) {
                alert('welp somethin wrong with the server');
            } else {
                // the server will give us our accepted message back. display it!
                var response_data = response_obj.data;
                add_message_with_data(response_data);
                compose_input.value = '';
            }
        } else if (xhr.status !== 200) {
            alert('message send failed. server returned status of ' + xhr.status);
        }
    };
    xhr.send('where=' + encodeURIComponent(chatroom) + '&who=' + encodeURIComponent(username) + '&message=' + encodeURIComponent(message));
}

/**
 * Get the latest messages from the server, based on the last time we checked.
 */
function get_messages() {
    // make the ajax call with the chatroom we're in and the last time we checked
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'chatroom.php?where=' + encodeURIComponent(chatroom) + '&since=' + encodeURIComponent(last_checkin));
    xhr.onload = function() {
        if (xhr.status === 200) {
            var response_obj = JSON.parse(xhr.responseText);
            if (response_obj.ok === undefined || response_obj.ok !== true) {
                alert('welp somethin wrong with the server');
            } else {
                last_checkin = response_obj.ts;
                var response_data = response_obj.data;
                if (response_data.length === 0) {
                    return; // we're done, there aren't any new messages
                }
                // oh snap we got messages, let's display 'em
                for (var i in response_data) {
                    add_message_with_data(response_data[i]);
                }
            }
        } else {
            alert('latest message fetching failed. server returned status of ' + xhr.status);
        }
    };
    xhr.send();
}

/**
 * Display a message given the right data.
 */
function add_message_with_data(message_data) {
    // make a stupid key out of this message for our client-side dedupe
    var message_key = message_data.ts + '-' + message_data.w;
    if (messages[message_key] !== undefined) {
        return; // we already have this message! skip it.
    } else {
        messages[message_key] = true; // we didn't have this message before, but now we do
    }
    // gotta do this stupid shit to make appendChild() work well
    // yeah this could be better
    var ugh = document.createElement('div');
    ugh.innerHTML = '<p class="message"><span class="ts">' + make_pretty_timestamp(Math.round(message_data.ts * 1000)) + '</span><span class="name '+ (username === message_data.w ? 'you' : '')+'">' + message_data.w + '</span><span class="message">' + message_data.m + '</span></p>';
    messages_container.appendChild(ugh.firstChild);
    // finally make sure we scroll to the bottom of the messages list
    chatroom_container.scrollTop = chatroom_container.scrollHeight;
}

/**
 * Make a pretty timestamp out of the given time.
 * @param int time A unix timestamp in milliseconds
 * @return string A pretty formatted timestamp
 */
function make_pretty_timestamp(time) {
    var date = new Date(time);
    var year = '' + date.getFullYear() + '';
    year = year.substr(2);
    var month = date.getMonth() + 1;
    if (month < 10) {
        month = '0' + month;
    }
    var day = date.getDate();
    if (day < 10) {
        day = '0' + day;
    }
    var hour = date.getHours();
    if (hour < 10) {
        hour = '0' + hour;
    }
    var minutes = date.getMinutes();
    if (minutes < 10) {
        minutes = '0' + minutes;
    }
    var seconds = date.getSeconds();
    if (seconds < 10) {
        seconds = '0' + seconds;
    }
    return '' + month + '-' + day + '-' + year + ' ' + hour + ':' + minutes + ':' + seconds + '';
}
