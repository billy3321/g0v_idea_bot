/*
bot.js, an idea bot for g0v organization.
usage: node bot.js
require module: irc, nickserv, node-trello
author: billy3321-AT-gmail-DOT-com
*/

var config = require('./config.json')
var trelloConfig = config.trelloConfig
var ircConfig = config.ircConfig
var Trello = require("node-trello");

var nickserv = require('nickserv');
var irc = require("irc");

var re = new RegExp("^" + ircConfig.botName + '|^#idea');

var bot = new irc.Client(ircConfig.server, ircConfig.botName, {
    channels: ircConfig.channels
});

nickserv.create(bot, {
  password: ircConfig.botPasswd
});

if(bot.nickserv.isRegistered()){
    bot.nickserv.identify();
    console.log('identify done');
}

var t = new Trello(trelloConfig.appKey, trelloConfig.userToken);

var boardList = {};

function update_data(){
    boardList = {};
    var url = "/1/members/g0v_idea_bot/idBoards";
    t.get(url, function(err, data) {
        if(err){
            console.log(err);
        }else{
            console.log(data);
            for(var i in data){
                var board_id = data[i];
                var url = "/1/boards/" + board_id + "/name";
                console.log(url);
                var callback = function(board_id){
                    return function(err, data) {
                        if(err){
                            console.log(err);
                        }else{
                            console.log(data);
                            var board_name = data['_value'].toLowerCase();
                            boardList[board_name] = {
                                id: board_id,
                                lists : {}
                            };
                            var url = "/1/boards/" + board_id + "/lists";
                            console.log(url);
                            t.get(url, function(err, data) {
                                if(err){
                                    console.log(err);
                                }else{
                                    console.log(data);
                                    for(var i in data){
                                        var list_name = data[i]['name'].toLowerCase();
                                        var list_id = data[i]['id'];
                                        boardList[board_name]['lists'][list_name] = {id: list_id};
                                    }
                                }
                            });
                        }
                    }
                }(board_id);
                t.get(url, callback);
            }
        }
    });
    console.log(boardList);
};

update_data();

function parseMessage(text){
    textArray = text.match(/'[^']+'|"[^"]+"|\S+/g);
    if (textArray){
        for (var i = 0; i < textArray.length; i+=1){
            textArray[i] = textArray[i].replace(/^'/, '');
            textArray[i] = textArray[i].replace(/'$/, '');
            textArray[i] = textArray[i].replace(/^"/, '');
            textArray[i] = textArray[i].replace(/"$/, '');
            if(i === (textArray.length - 1) || i === (textArray.length - 2)){
                textArray[i] = textArray[i].replace(/_/, ' ');
            }
        }
        console.log(textArray);
        return textArray;
    }else{
        return false;
    }
    
}

function findListId(t, boardName, listName, callback){
    console.log(boardName, listName);
    boardName = boardName.toLowerCase();
    listName = listName.toLowerCase();
    if(boardList.hasOwnProperty(boardName)){
        var boardId = boardList[boardName]['id'];
        var lists = boardList[boardName]['lists'];
        var listId = null;
        if(lists.hasOwnProperty(listName)){
            listId = lists[listName]['id'];
            return listId;
        }else{
            console.log("can't find listname.");
            callback("can't find list name.");
            return false;
        }
    }else{
        console.log("can't find boardname.");
        callback("can't find board name.");
        return false;
    }
}

function addCard(t, data, callback){
    url = "/1/cards"
    t.post(url, data, function(err, data){
        if (err) {
            console.log("err " + err);
            return false;
        }else{
            callback(data['url']);
            console.log(data);
            return true;
        }
    });
}

bot.addListener("message", function(from, to, text, message) {
    //bot.say(config.channels[0], from + to + text + message + "¿Public que?");
    console.log(text);
    if(re.test(text)){
        console.log(text);
        //console.log(from, to, text, message);
        var textArray = parseMessage(text);
        console.log(textArray);
        console.log(textArray.length);
        if(textArray.length === 4){
            var listId = findListId(t, textArray[2], textArray[3], function(msg){
                bot.say(to, msg);
            });
            console.log("listId1:", listId);
            if(listId){
                var data = {
                    name: textArray[1],
                    desc: "Added by " + from + " through IRC.",
                    idList: listId
                }
                console.log(data);
                var ret = addCard(t, data, function(url){
                    bot.say(to, from + " card added, url is " + url);
                });
            }else{
                bot.say(to, from + " sorry, parse error. card add false.");
                return false;
            }
        }else if(textArray.length === 3){
            var listId = findListId(t, textArray[2], 'to do', function(msg){
                bot.say(to, msg);
            });
            if(listId){
                var data = {
                    name: textArray[1],
                    desc: "Added by " + from + " through IRC.",
                    idList: listId
                }
                var ret = addCard(t, data, function(url){
                    bot.say(to, from + " card added, url is " + url);
                });
            }else{
                bot.say(to, from + " sorry, parse error. card add false.");
                return false;
            }
        }else if(textArray.length === 2){
            if(textArray[1].toLowerCase() === 'help'){
                bot.say(to, "Add card: idea card_name board_name [list_name]");
                bot.say(to, "Show boards list: idea boardlist");
            }else if(textArray[1].toLowerCase() === 'boardlist'){
                for(var i in boardList){
                    var message = i + ":";
                    for(var j in boardList[i]['lists']){
                        if(message[message.length - 1] === ":"){
                            message = message + " " + j;
                        }else{
                            message = message + ", " + j;
                        }
                        
                    }
                    bot.say(to, message);
                }
                
            }
        }else{
            bot.say(to, from + " sorry, parse error. text length = " + textArray.length);
            return false;
        }
    }else{
        return true;
    }
});
