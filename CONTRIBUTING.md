# 知り合いと共同開発する

共有先は https://github.com/aquestionasdasd/bomber 。GitHubはゲームのプログラムと変更履歴を置く共有フォルダーです。プレイ用URLとは別で、ここを変更しただけでは公開ゲームには反映されません。

## 参加してもらう

1. 相手にGitHubアカウントを作ってもらい、ユーザー名を聞きます。
2. リポジトリの Settings → Collaborators → Add people でそのユーザー名を追加し、相手に招待を承認してもらいます。所有者のアカウントやパスワードを渡す必要はありません。
3. 相手はこのリポジトリをcloneして、CodexまたはClaude Codeでそのフォルダーを開きます。AGENTS.md / CLAUDE.md に共通ルールがあります。

ユーザー名が分からない間も、公開リポジトリの閲覧・ダウンロードと、相手側のforkからのPRは可能です。直接pushする権限の招待は後から行えます。

## 初回の起動

Node.js 22.13以上とGitを入れてから、以下を実行します。

```sh
git clone https://github.com/aquestionasdasd/bomber.git
cd bomber
npm ci
node server.cjs
```

ソロ・マップ練習は http://127.0.0.1:8018/play.html で開きます。簡易サーバーにはオンライン部屋APIがありません。公開サイトで知り合いと遊ぶだけならインストールは不要です。

ローカルでオンラインAPIも開発する場合はREADMEの「ローカルデータベースの初期化とビルド版」に従います。DBはローカルだけ初期化し、公開DBのコピーや秘密の環境変数を共有しないでください。共有版のhosting設定はローカルDB用で、所有者の公開Sites IDは含めません。

## 変更を送る

公開版に対応する更新が未取り込みのPRとして積み重なっている場合、`main` は最新のゲームより古いことがあります。作業前に所有者と開始元を揃え、指定された最新PRの作業ブランチから自分のブランチを作ってください。PRの「base」が直前のPRを指す場合は、その前提変更も必要です。途中のPRだけをmainへ取り込んだり、各自の古いコピーで上書きしたりしないでください。どの版を使っているかは `SOURCE-SNAPSHOT.json` とPRの説明で確認できます。

二人で同じフォルダーを直接編集するのではなく、各自のPCへcloneします。「担当・開始ブランチ・触るファイル」を先に決め、作業開始時に最新の変更を取得してください。同じ箇所が競合したら、両方の意図を確認して直し、関連テストを再実行します。招待は相手自身のGitHubアカウントへ行い、所有者のログイン情報は共有しません。

```sh
git switch main
git pull --ff-only
git switch -c codex/short-description
# public/ 等を編集する
node tests-abilities.cjs
# 変更した分野に対応する tests-*.cjs を実行する
git add public/ tests-*.cjs
git commit -m "変更内容"
git push -u origin codex/short-description
```

GitHubで表示される Compare & pull request を押し、何を変更したか・何を確認したか・未確認は何かを書きます。所有者がレビューしてmainへ取り込みます。公開は所有者のSites接続から別途行います。GitHub側の変更は、先に取り込んでテストしてから正規Sites helperで本番へ公開します。

## テストと担当箇所

| 変更 | 主なソース | 関連する確認 |
| --- | --- | --- |
| マップ/通路/床 | public/map.js、collision.js、navigation.js | tests-tactical-layout / site-areas / concourse-surfaces |
| 技/キャラ | public/abilities.js、character-skills.js、各FX | tests-abilities / character-skills / 対応FX |
| 移動/入力/試合 | public/game.js、rules.js | tests-rules、統合 tests.cjs |
| オンライン | public/online.js、game.js、server/ | tests-online.cjs、独立host/guest検証 |
| NOPEデコイ | public/nope-decoys.js、nope-decoy-fx.js | tests-nope-decoys / nope-decoy-fx / nope-decoy-game |

`npm run check` は全体確認で数分かかります。最初は変更分の試験を実行し、試合・同期・移動など広い範囲を変更したときに全体へ広げます。テストのために音を鳴らさないでください。

## Codex / Claudeに渡す例

「AGENTS.md、CONTRIBUTING.md、DEVELOPMENT-BACKLOG.mdを読み、○○を直してください。public/を編集し、関連テストを実行して変更と未確認事項を説明してください。新しいcodex/ブランチからPRを作り、公開サイトへの直接デプロイはしないでください。」

GitHubは現在publicです。ゲームにはユーザー指定画像を元にしたキャラクターと外部素材が含まれます。新しい第三者素材を追加するときは利用条件を確認し、配布可能なものだけ同梱します。認証・個人用設定・DBをcommitしないでください。
