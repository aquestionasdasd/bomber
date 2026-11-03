# 枚方市駅：歩行映像に基づくマップ改修

2026-11-02。所有者撮影の6本・約12分25秒から、接続する経路、内外装、高低差の特徴を参照した。99場面と各動画の接続端を比較したもので、全フレームの連続精査や測量ではない。

## 実装した内容

- 南側の長い階段 → 西側のタイル通路 → 木床の中央改札 → 北側のバルコニー → 短い上り階段 → 歩道橋 → 公園への下り階段を接続。元の4階段を保持し、短い上階段と公園階段を追加した。床高0 / 5.02 / 6.10mはゲーム用の近似値。
- 公園を北西の未確認オフィス街区に置き換えた。レンガと青い床模様、植栽、ベンチ、滑り台、ブランコ、布状の日除け、休憩棟を構成した。公園の正式名称は映像から未確定。
- 1F自由通路に曲線の床模様と風景を抽象化した丸柱のラッピング。2Fは木巻き角柱、木床、明るい低い天井、露出した設備と照明、売場什器を追加した。天井・柱・階段・歩道橋の支持と当たり判定を描画へ合わせた。
- 南口バス停を奥行きのある連続した庇にし、南側T-SITEの単一の箱を、床ごとに張り出すガラスの立体へ変更した。
- 木床と木巻き柱に画像生成AIで作成した木材テクスチャを使用した。動画中の人物・広告・写真をゲーム用画像として同梱していない。

マップ選択で「枚方市駅」→「マップ練習」。Mの「公園 / 映像参考」「北側デッキ / 公園連絡」「西側連絡通路」から確認できる。公園は従来の224m練習エリアにあり、164mの対戦境界と10スポーン、2サイト、3つの地上進入経路、バスの経路・速度・音源バイトは保持した。

## 検証と限界

`tests-hirakata-video-route.cjs` は保存済みの実ゲーム処理を用い、ジャンプ・テレポートなしの通路往復、足場、頭上の天井、練習/対戦境界、崩壊と復元を検査する。20/60/144Hzで6往復経路・16,504移動フレーム。既存の全階段試験も新階段を含め、通常移動・スライド・ジェット・ダッシュ・host管理リモート移動で検査する。

形状変更用に `tests-fixtures/hirakata-video-v260-structure.json` を追加した。旧v104 fixtureは残している。旧「4階段/797衝突」の期待値を6階段/1031衝突へ更新し、体積・各壁・支持・リセットを正確に照合する。バスposeの歴史的ハッシュは現在のfuel/driver状態より古かったため、改修前ソース422bed0で採取したposeへ更新した。改修前後のpose配列は同一。既存の実ゲーム試験には、現行150ダメージのバスにHP100/装甲50で接触して生存するとする旧期待値があり、改修前422bed0でも同じ箇所が失敗した。現行の通常装甲式に従うHP0/装甲0/死亡を厳密に検査するよう修正し、バスの威力自体は変更していない。

構造予算は272 mesh / 10,906 instance / 142,306 triangles / 233破壊group。従来の上限280 / 13,000 / 180,000 / 256以内。従来82bitの破壊maskを引き続き受理し、新しい完全maskも64文字以内。独立host/guest JSONと次ラウンド復元も既存試験で検証する。

無音の専用headless ChromiumのソフトウェアWebGLで描画を確認する。実端末のFPS・聴感・実回線の5対5品質の保証ではない。形状は既存競技マップを保持した圧縮配置で、現実の駅の寸法・全店舗・全分岐を忠実に再現した完成測量モデルではない。北側建築の細かな張り出し、未踏のエスカレーター分岐、実物に近い曲線階段、周辺店頭は引き続き改善余地がある。

## AI素材と生成指示

素材：`public/images/materials/hirakata-oak-v1.png`。組み込みimage_genを使用。外部サービスの契約・有料クレジットの購入は行っていない。原画像を変換せず同梱し、反復・色・異方性はゲーム内材質で設定した。

最終プロンプト：

> Use case: photorealistic-natural. Asset type: seamless repeatable albedo texture for a real-time browser game, NOT a rendered room. Primary request: square top-down scan-like texture of warm honey oak strip flooring in a Japanese railway station concourse. Flat orthographic view, edge-to-edge material only, straight parallel narrow oak planks, staggered end joints, subtle realistic fine wood grain, restrained natural warm tan variations. Each plank long axis vertical in the image. Even diffuse neutral lighting, NO baked shadows, highlights, perspective, vignetting, grout, objects, people, text, logos or borders. Tile seamlessly on all four edges. Fine consistent grain scale, clean maintained satin wood, non-dramatic colors. Output one square texture.
