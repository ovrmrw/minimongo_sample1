title: minimongoでバルクインサート用のjsonファイルをインポートして試してみた。

## minimongo, バルクインサート, Node.js

### 前置き
Webアプリ開発してるとDBを扱いたくなりますよね。きっとそうに違いない。  
でもいちいちDBをインストールするのもめんどうですよね。きっとみんなそう思ってる。  
で、

[minimongoでIsomorphic Storage](http://qiita.com/mizchi/items/e42cdf9eb0707fe86974)

を読んで、**何もインストールしなくてもサンプルコードでDBを動かせる**ならちょっといいかもと思ってminomongoを試してみました。

[mWater/minimongo](https://github.com/mWater/minimong)

README通りに試してみると、おお、確かに動く！DBっぽいものが！

こうなるとテストデータを入手してそこそこのデータ量で試してみたくなりますね。そこで↓なんかいいんじゃないかと。

[jsteemann/BulkInsertBenchmark](https://github.com/jsteemann/BulkInsertBenchmark)

今回は上記リポジトリにある`names_part_1000.json.gz`を使ってみます。  
ちなみにWindows環境では7zipで解凍できました。

ところがこのファイル、正規のJSONフォーマットではありません。
```json
{"a":"xxx","b":"yyy","z":"zzz"}
{"a":"xxx","b":"yyy","z":"zzz"}
...
```
みたいな感じで、配列にもなっていないし、オブジェクトの区切りがカンマじゃなくて改行なんですね。  
前にもバルクインサート用のデータで同じような形式を見たことがあるのですが、もしかしてこれバルクインサートの標準形?

とりあえずこのままではminimongoでインサートできないので、こういう正規のフォーマットに変換してあげないといけません。
```json
[
{"a":"xxx","b":"yyy","z":"zzz"},
{"a":"xxx","b":"yyy","z":"zzz"}
]
```

そのサンプルコードがこちら↓
```javascript
var splitter = '\r\n';
var lines = fs.readFileSync('./names_part_1000.json', 'utf-8').toString().split(splitter);
lines = _.filter(lines, function (line) {
  return line.indexOf('{') > -1 && line.indexOf('}') > -1
});
var json = "[" + splitter + lines.join(',' + splitter) + splitter + "]";
```
ファイルを読み込んで、改行コードでsplitして、空白行があれば除去して、配列の形に組み直す。  
やってみたら意外と簡単でした。

### 実際にやってみよう

### 必要なパッケージをnpm installします
```
npm install minimongo fs lodash --save
```

### バルクインサートするファイルを用意します
[jsteemann/BulkInsertBenchmark](https://github.com/jsteemann/BulkInsertBenchmark)  
のdatasetsフォルダに`names_part_1000.json.gz`があるので、これを7zip等で解凍して`names_part_1000.json`を取り出します。

### JSファイルを書きます。
```javascript
// bulkinsert.js

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

db.names.upsert(obj, function () {
  db.names.find({ 'name.first': 'Johnson' }, {})
    .fetch(function (res) {
      _.forEach(res, function (person) {
        console.log(person.name);
      });
    });
});

// ついでに変換後のjsonを保存。
fs.writeFileSync('./names_valid.json', JSON.stringify(obj, null, 2));
```

### 実行します
```
node bulkinsert.js
```
結果はこうなりました↓
```
{ first: 'Johnson', last: 'Diventura' }
{ first: 'Johnson', last: 'Wallick' }
```

ちなみに`db.names.find()`は検索条件`{ 'name.first': 'Johnson' }`に一致するオブジェクトを配列で取得する関数ですが、
一件だけ取得するなら`db.names.findOne()`という関数があります。  
`find().fetch()`の`fetch`は`then`みたいなものだと思います。(多分)

結論としては…**かなりイイね！**

## 追記: LIKE検索
SQLでいうところのLIKE検索をしたいときは、`{ 'name.first': 'Johnson' }`のところを`{ 'name.first': /john/i }`のようにします。正規表現ですかね。  

サンプルコードを一部書き換えてみます。
```javascript
db.names.upsert(obj, function () {
  //db.names.find({ 'name.first': 'Johnson' }, {})
  db.names.find({ 'name.first': new RegExp('john', 'i') }, {})
    .fetch(function (res) {
      _.forEach(res, function (person) {
        console.log(person.name);
      });
    });
});
```
`RegExp()`なら文字列から正規表現を作れます。(さっき知った)

結果はこうなりました↓
```
{ first: 'Johnny', last: 'Kaster' }
{ first: 'Johnie', last: 'Bugler' }
{ first: 'Johnnie', last: 'Domine' }
{ first: 'Johnson', last: 'Diventura' }
{ first: 'Johnson', last: 'Wallick' }
```  
`/john/i`は、文字列`john`(大文字小文字を問わない)が含まれるものを検索するという意味になります。    
個人的には**LIKE検索ができないDBはDBじゃない**のでこれでしばらくいじり倒したいと思います。

---

以上です、ありがとうございました。