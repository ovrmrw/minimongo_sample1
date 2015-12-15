/*
  バルクインポート用のような"正規のJSON形式"になっていないjsonファイルをインポートするサンプルコード
*/
var splitter = '\n';

var minimongo = require("minimongo");
var fs = require('fs');
var _ = require('lodash');

var LocalDb = minimongo.MemoryDb;

var db = new LocalDb();

db.addCollection("names");

var lines = fs.readFileSync('./names_part_1000.json', 'utf-8').toString().split(splitter);
lines = _.filter(lines, function (line) {
  return line.indexOf('{') > -1 && line.indexOf('}') > -1
});

var json = "[" + splitter + lines.join(',' + splitter) + splitter + "]";

var obj = JSON.parse(json);

var condition = new RegExp('john', 'i');

db.names.upsert(obj, function () {
  db.names.find({ 'name.first': condition }, {})
    .fetch(function (res) {
      _.forEach(res, function (person) {
        console.log(person.name);
      });
    });
});

// ついでに変換後のjsonファイルを作成。
fs.writeFile('./names_valid.json', JSON.stringify(obj, null, 2));