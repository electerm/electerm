<h1 align="center" style="padding-top: 60px;padding-bottom: 40px;">
    <a href="https://electerm.org">
        <img src="https://github.com/electerm/electerm-resource/raw/master/static/images/electerm.png", alt="" />
    </a>
</h1>

[![GitHub version](https://badgers.space/github/release/electerm/electerm?corner_radius=m)](https://github.com/electerm/electerm/releases)
[![Build Status](https://github.com/electerm/electerm/actions/workflows/mac-test-1.yml/badge.svg)](https://github.com/electerm/electerm/actions)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/electerm/electerm/blob/master/LICENSE)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/electerm?label=Sponsors)](https://github.com/sponsors/electerm)
[![star](https://atomgit.com/electerm/electerm/star/badge.svg)](https://atomgit.com/electerm/electerm)

[English](../../README.md) | [中文](README_cn.md) | [日本語](README_jp.md)

オープンソースのターミナル/ssh/sftp/telnet/シリアルポート/RDP/VNC/Spice/ftp クライアント(Linux, Mac, Windows, Android, HarmonyOS)。

主流の Windows/macOS/Linux/Android に加えて、electerm は HarmonyOS や、Ubuntu 18、Windows 7、macOS 10 以降といった古いシステム、さらに UOS、Kylin(麒麟)、LoongArch(龍芯、old-world / new-world の両方)などの中国製 Linux ディストリビューションにも対応しています。

<p>
  <a href="https://electerm.org">ホームページ / ダウンロード</a> ·
  <a href="https://theme.electerm.org">テーマ</a> ·
  <a href="https://github.com/electerm/electerm-web-docker">Docker</a> ·
  <a href="https://demo.electerm.org">オンラインデモ</a> ·
  <a href="https://github.com/electerm/electerm-android">Android</a> ·
  <a href="https://github.com/electerm/electerm-harmony">HarmonyOS</a> ·
  <a href="https://appgallery.huawei.com/app/detail?id=org.electerm.electerm">Huawei AppGallery</a> ·
  <a href="https://www.microsoft.com/store/apps/9NCN7272GTFF">Microsoft Store</a> ·
  <a href="https://snapcraft.io/electerm">Snap Store</a> ·
  <a href="https://repos.electerm.org/deb">deb リポジトリ</a> ·
  <a href="https://repos.electerm.org/rpm">rpm リポジトリ</a>
</p>

<div>🌐 <strong><a href="https://cloud.electerm.org">electerm online</a></strong> — 無料で使える公開オンライン版 electerm</div>
<div>🤖 <strong><a href="https://ai.electerm.org">electerm AI</a></strong> — electerm ユーザー向けの無料 AI</div>
<div>💻 <strong><a href="https://github.com/electerm/electerm-web">electerm-web</a></strong> — ブラウザ(モバイル端末を含む)で動作する Web アプリ版</div>

## Atlas Cloud

<div align="center">
  <a href="https://www.atlascloud.ai/?utm_source=github&utm_medium=link&utm_campaign=electerm">
    <img src="https://github.com/electerm/electerm-resource/blob/master/static/images/atlas-cloud.png?raw=true" alt="Atlas Cloud" height="200" />
  </a>
</div>

[Atlas Cloud](https://www.atlascloud.ai/?utm_source=github&utm_medium=link&utm_campaign=electerm) は、electerm での AI 活用ワークフロー向けに、OpenAI 互換の AI API とモデルへのアクセスを提供しています。

----

<div align="center">
  <a href="https://www.apismart.ai">
    <img src="https://github.com/electerm/electerm-resource/blob/master/static/images/apismart400x400.png?raw=true" alt="ApiSmart" width="200" />
  </a>
</div>

[ApiSmart](https://www.apismart.ai) は、単一の API を通じて主要な AI モデルへ統一的にアクセスできるサービスです。1 つの API キーで、OpenAI 互換のインターフェースから LLM・画像・動画モデルを利用でき、複数のプロバイダーを個別に管理する必要がありません。モデルの切り替えが簡単になり、請求もシンプルになるうえ、インテリジェントなルーティングと自動フェイルオーバーによって信頼性も向上します。1 つの統合された API プラットフォームで、AI アプリケーションの構築とスケールをより速く実現できます。

----

<div align="center">

<a href="https://www.digitalocean.com/?refcode=c10bcb28b846&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge"><img align="middle" src="https://web-platforms.sfo2.cdn.digitaloceanspaces.com/WWW/Badge%202.svg" alt="DigitalOcean Referral Badge" /></a>&nbsp;&nbsp;&nbsp;<a href="https://oss-directory.vercel.app"><img align="middle" src="https://github.com/electerm/electerm-resource/blob/master/static/images/vercel-oss-2005.png?raw=true" alt="Vercel OSS Program" /></a>

</div>

<div align="center">
  <img src="https://github.com/electerm/electerm-resource/raw/master/static/images/electerm-banner-1.jpg", alt="" />
</div>

## 機能

- ターミナル/ファイルマネージャー、または ssh/sftp/ftp/telnet/シリアルポート/RDP/VNC/Spice クライアントとして動作
- Windows 7 以降(X64/ARM64)、HarmonyOS、Android、Mac OS 10.15 以降(x64/arm64)、Linux(x64/arm64/Loong64 new world & old world)に対応。UOS/Kylin/Ubuntu 18.04 などの glibc 2.17 以降の古い Linux でも動作
- グローバルホットキーによるウィンドウ表示の切り替え(guake と同様、デフォルトは `ctrl + 2`)
- マルチプラットフォーム対応(linux, mac, win)
- 🇺🇸 🇨🇳 🇧🇷 🇷🇺 🇪🇸 🇫🇷 🇹🇷 🇭🇰 🇯🇵 🇸🇦 🇩🇪 🇰🇷 🇮🇩 🇵🇱 多言語対応([electerm-locales](https://github.com/electerm/electerm-locales)、貢献・修正を歓迎します)
- ダブルクリックでリモートの(小さな)ファイルを直接編集
- 公開鍵 + パスワードによる認証
- Zmodem(rz, sz)に対応
- ssh トンネルに対応
- [Trzsz](https://github.com/trzsz/trzsz)(trz/tsz)に対応。rz/sz と同様の機能で、tmux とも互換性があります
- 透過ウィンドウ(Mac, win)
- ターミナルの背景画像
- グローバル/セッションごとのプロキシ
- クイックコマンド
- UI/ターミナルのテーマ
- ブックマーク/テーマ/クイックコマンドを github/gitee の secret gist、webdav、カスタムサーバー、electerm cloud に同期
- 1 つまたはすべてのターミナルへのクイック入力
- AI アシスタント連携([DeepSeek](https://www.deepseek.com)、OpenAI、その他あらゆる AI API に対応)により、コマンドの提案、スクリプトの作成、選択したターミナル内容の説明、ブックマーク/テーマの作成をサポート
- AI アシスタントや外部ツールと連携するための MCP(Model Context Protocol)ウィジェット — [MCP ウィジェット利用ガイド](https://github.com/electerm/electerm/wiki/MCP-Widget-Usage-Guide)を参照
- ディープリンク対応: `telnet://192.168.2.31:34554` や `ssh://user@host:22` のような URL から接続を開けます — [ディープリンク対応の wiki](https://github.com/electerm/electerm/wiki/Deep-link-support)を参照
- コマンドラインからの利用: [wiki](https://github.com/electerm/electerm/wiki/Command-line-usage) を参照

## インストール

- Mac ユーザーの場合: `brew install --cask electerm`
- snap の場合: `sudo snap install electerm --classic`
- 一部の Linux ディストリビューションでは、OS 標準のアプリストアから入手できます(Ubuntu, Deepin, Mint...)。
- 一部の Linux OS では `rpm`、`deb`、`snap` 版が動作しない場合があります。その場合は `tar.gz` または `.appImage` 版をお試しください。
- Windows ユーザーは [Windows ストア](https://www.microsoft.com/store/apps/9NCN7272GTFF)からインストールできます。コマンドラインインストーラーの [winget](https://github.com/microsoft/winget-cli) や [scoop](https://github.com/lukesampson/scoop) もおすすめです:

```powershell
# winget https://github.com/microsoft/winget-cli
winget install electerm.electerm

# scoop https://github.com/lukesampson/scoop
scoop bucket add dorado https://github.com/chawyehsu/dorado
scoop install dorado/electerm
```

- Debian リポジトリからのインストール(Debian/Ubuntu 系システム向け、`apt` コマンドを使用)

[https://repos.electerm.org/deb](https://repos.electerm.org/deb) を参照してください。

- npm からのインストール

```bash
npm i -g electerm

```

## アップグレード

- 自動アップグレード: 新しいバージョンがリリースされると、次回 electerm を起動した際にアップグレード通知が表示されます。アップグレードボタンをクリックするだけで更新できます。
- ダウンロード: 最新版をダウンロードして、再インストールしてください。
- Npm: npm でインストールした場合は、再度 `npm i -g electerm` を実行してください。
- Snap やその他のディストリビューションシステムを使用している場合は、それらのシステムがアップグレードを提供することがあります。

## 既知の問題

[https://github.com/electerm/electerm/wiki/Know-issues](https://github.com/electerm/electerm/wiki/Know-issues)

## トラブルシューティング

[https://github.com/electerm/electerm/wiki/Troubleshoot](https://github.com/electerm/electerm/wiki/Troubleshoot)

## ディスカッション

[![Discord](https://img.shields.io/badge/Discord-Join-blue?logo=discord)](https://discord.gg/855W7g8EVd)

[ディスカッションボード](https://github.com/electerm/electerm/discussions)

![electerm-wechat-group-qr.jpg](https://electerm.org/electerm-wechat-group-qr.jpg)

## サポート

ぜひご意見をお聞かせください。[issue の投稿](https://github.com/electerm/electerm/issues)、[新しいディスカッションの開始](https://github.com/electerm/electerm/discussions/new)、[言語ファイルの作成・修正](https://github.com/electerm/electerm-locales)、プルリクエストの作成など、どれも歓迎します。

## このプロジェクトを支援する

github sponsor

[https://github.com/sponsors/electerm](https://github.com/sponsors/electerm)

kofi

[https://ko-fi.com/zhaoxudong](https://ko-fi.com/zhaoxudong)

wechat donate

[![wechat donate](https://electerm.org/electerm-wechat-donate.png)](https://github.com/electerm)

TRON TRN20

[![TRN20 donate](https://github.com/electerm/electerm-resource/blob/master/static/images/trn20.png?raw=true)]

アドレス: TXk3pQNmQu1vihH76RaEFnK9wg13x4LLCZ

## 開発

```bash
# Linux でのみ動作する可能性があります
# nodejs/npm が必要です。nvm を使ったインストールを推奨します
# nodejs 24.x を使用

git clone git@github.com:electerm/electerm.git
cd electerm
npm config set legacy-peer-deps true
npm i

# vite 開発サーバーを起動します。ポート 5570 が必要です
npm start

# 別のターミナルセッションでアプリを実行します
npm run app

# コードフォーマットのチェック
npm run lint

# コードフォーマットの修正
npm run fix
```

## テスト

```bash
npm run b
npm run prepare-test
cp ./build/.sample.env ./.env

# .env を編集して、テスト用のホスト/ユーザー名/パスワードを入力してください。mac OS でのみ動作する可能性があります
npm run test
```

## ビルドのテスト

```bash
# Linux でのみ動作する可能性があります
# 先に yarn をインストールしてください(yarn autoclean を実行するため)
# https://yarnpkg.com/en/docs/install を参照

# -l で linux 向けのみビルド
npm i
npm run b
npm run pb
./node_modules/.bin/electron-builder --linux tar.gz
# tar.gz は rpm/deb/AppImage に置き換え可能です
# dist/ フォルダーを確認してください

# linux arm 向けのビルド
./node_modules/.bin/electron-builder --linux --arm64
```

## 動画ガイド

- [https://electerm.org/videos](https://electerm.org/videos)

## 変更履歴

[Releases](https://github.com/electerm/electerm/releases) をご覧ください。

## 作者への連絡

[zxdong@gmail.com](mailto:zxdong@gmail.com)


## ライセンス

MIT

## Star History

<p>
 <a href="https://www.star-history.com/electerm/electerm"><img src="https://api.star-history.com/badge?repo=electerm/electerm" alt="Star History Rank" /></a>
</p>

<a href="https://www.star-history.com/?repos=electerm%2Felecterm&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=electerm/electerm&type=date&legend=top-left&sealed_token=DvPlttPaLtq6RPIWRANYX08-8ZJyrJalhombrkDcg1IwWOMPMIplgi85q0FiwrbhE3lRIi_yxvOWdell731CGQvzlfJMt2Sa6VfCvQ80BwEtQ6RpPchEiw" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=electerm/electerm&type=date&legend=top-left&sealed_token=DvPlttPaLtq6RPIWRANYX08-8ZJyrJalhombrkDcg1IwWOMPMIplgi85q0FiwrbhE3lRIi_yxvOWdell731CGQvzlfJMt2Sa6VfCvQ80BwEtQ6RpPchEiw" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=electerm/electerm&type=date&legend=top-left&sealed_token=DvPlttPaLtq6RPIWRANYX08-8ZJyrJalhombrkDcg1IwWOMPMIplgi85q0FiwrbhE3lRIi_yxvOWdell731CGQvzlfJMt2Sa6VfCvQ80BwEtQ6RpPchEiw" />
 </picture>
</a>
