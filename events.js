/**
 * OphthalConf - 眼科医向け 講演会・学会イベントマスターデータ
 * 最終更新: 2026-10-04
 * 
 * 収録範囲:
 *  - 日本眼科学会 関連眼科関連学会（Related Ophthalmic Societies）全網羅
 *  - 2026〜2028年 国内主要学術集会（公式サイト優先照合済み）
 *  - 2026〜2028年 日本人眼科医が参加しやすい主要国際学会
 * 
 * フィールド仕様:
 *  - id: 一意なイベントID（既存ID維持、新規は conf-jp-{slug}-{year} / conf-int-{slug}-{year}）
 *  - title, subtitle: 学会・講演会名
 *  - date, endDate: 開催期間（YYYY-MM-DD）
 *  - time: 開催時間帯 / セッション時間
 *  - region: 国内地域区分（北海道/東北/関東/中部/関西/中国/四国/九州・沖縄、または "海外"）
 *  - venueId: 任意。venues.js の安定ID（未指定の場合は venue を使用）
 *  - timeZone: 任意。IANAタイムゾーン名（会場マスター未登録の場合にも使用可能）
 *  - venue: 開催会場（未定の場合は "未定"）
 *  - specialty: 専門領域（一般眼科/網膜・硝子体/緑内障/白内障/角膜・外眼部/小児・斜視弱視/神経眼科/眼形成/その他）
 *  - eventType: "国内学会" | "海外学会" | "講演会・勉強会" | "地方会・研究会"
 *  - format: "現地" | "Web" | "ハイブリッド"
 *  - sponsor: 主催・共催団体
 *  - sponsors: 任意。[{ companyId: companies.js の会社ID, role: "co-sponsor" }]（確認済みの共催企業）
 *  - credits: 認定単位情報
 *  - conferenceRegion: "domestic" | "international"
 *  - conferenceCategory: "総合" | "網膜硝子体" | "緑内障" | "白内障屈折" | "角膜" | "小児斜視" | "神経眼科" | "形成腫瘍" | "眼炎症感染" | "眼光学CL近視" | "ロービジョン" | "AI" | "その他"
 *  - conferenceTier: "primary" (基幹学会) | "subspecialty" (分科学会) | "allied" (準分科・関連)
 *  - period: 会期テキスト表示
 *  - cityCountry: 開催都市・国
 *  - abstractDeadline, earlyBirdDeadline: 締切表記
 *  - officialUrl: 公式サイトURL（未確認時は ""）
 *  - sourceUrl: 情報ソースURL（日本眼科学会等）
 *  - abstractSubmission: { status: "open"|"upcoming"|"closed"|"unknown", startDate, deadline, url }
 *  - calendarStatus: { google: { status, conflicts }, icloud: { status, conflicts }, isAdded }
 */

const sampleEvents = [
  {
    "id": "conf-jp-surgery-2026",
    "title": "第49回 日本眼科手術学会学術総会",
    "subtitle": "眼科手術の進化と未来への挑戦",
    "date": "2026-01-30",
    "endDate": "2026-02-01",
    "time": "全日程",
    "region": "九州・沖縄",
    "venue": "福岡国際会議場、マリンメッセ福岡B館",
    "specialty": "白内障",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本眼科手術学会",
    "credits": "日本眼科学会専門医認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "白内障屈折",
    "conferenceTier": "primary",
    "period": "2026年1月30日(金) 〜 2月1日(日)",
    "cityCountry": "福岡市（福岡県） / 日本",
    "abstractDeadline": "締切済",
    "earlyBirdDeadline": "締切済",
    "officialUrl": "https://www.jsos.jp/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "closed",
      "startDate": null,
      "deadline": null,
      "url": "https://www.jsos.jp/"
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "眼科手術",
      "白内障手術",
      "硝子体手術",
      "緑内障手術",
      "福岡開催"
    ],
    "description": "白内障・硝子体・緑内障・角膜・屈折矯正など眼科全領域の手術手技が集う全国学術総会。",
    "isConference": true
  },
  {
    "id": "conf-jp-eyelid-2026",
    "title": "第37回 日本眼瞼義眼床手術学会学術集会",
    "subtitle": "機能と整容の両立をめざす眼瞼・義眼床手術",
    "date": "2026-02-07",
    "endDate": "2026-02-07",
    "time": "09:00 - 17:00",
    "region": "関西",
    "venue": "関西医科大学 加多乃講堂",
    "specialty": "眼形成",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本眼瞼義眼床手術学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "形成腫瘍",
    "conferenceTier": "subspecialty",
    "period": "2026年2月7日(土)",
    "cityCountry": "枚方市（大阪府） / 日本",
    "abstractDeadline": "締切済",
    "earlyBirdDeadline": "締切済",
    "officialUrl": "https://jsprs.or.jp/member/meeting_info/2026/37gigan/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "closed",
      "startDate": null,
      "deadline": null,
      "url": ""
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "眼瞼手術",
      "義眼床",
      "眼窩再建",
      "結膜嚢形成"
    ],
    "description": "形成外科医、眼科医、義眼師による眼瞼および義眼床手術の機能と整容性を追求する学術集会。",
    "isConference": true
  },
  {
    "id": "conf-jp-cornea-2026",
    "title": "角膜カンファランス2026（第50回日本角膜学会総会／第42回日本角膜移植学会）",
    "subtitle": "半世紀の歩みと未来への飛翔：角膜診療の最前線",
    "date": "2026-02-19",
    "endDate": "2026-02-21",
    "time": "全日程",
    "region": "関東",
    "venue": "TAKANAWA GATEWAY Convention Center",
    "specialty": "角膜・外眼部",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本角膜学会 / 日本角膜移植学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "角膜",
    "conferenceTier": "subspecialty",
    "period": "2026年2月19日(木) 〜 2月21日(土)",
    "cityCountry": "東京都 / 日本",
    "abstractDeadline": "締切済",
    "earlyBirdDeadline": "締切済",
    "officialUrl": "https://www.congre.co.jp/cornea2026/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "第50回日本角膜学会総会・第42回日本角膜移植学会 合同開催",
    "abstractSubmission": {
      "status": "closed",
      "startDate": null,
      "deadline": null,
      "url": "https://www.congre.co.jp/cornea2026/"
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "角膜カンファランス",
      "角膜内皮移植",
      "アイバンク",
      "角膜感染症"
    ],
    "description": "角膜疾患、角膜移植術、ドライアイ、眼表面再建の最新知見が集う年次学術集会。",
    "isConference": true
  },
  {
    "id": "conf-jp-jos-2026",
    "title": "第130回 日本眼科学会総会",
    "subtitle": "眼科学の原点と革新",
    "date": "2026-04-09",
    "endDate": "2026-04-12",
    "time": "全日程（一部Webオンデマンド）",
    "region": "九州・沖縄",
    "venue": "福岡国際会議場、マリンメッセ福岡（A館・B館）",
    "specialty": "一般眼科",
    "eventType": "国内学会",
    "format": "ハイブリッド",
    "sponsor": "日本眼科学会",
    "credits": "日本眼科学会専門医認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "総合",
    "conferenceTier": "primary",
    "period": "2026年4月9日(木) 〜 4月12日(日)",
    "cityCountry": "福岡市（福岡県） / 日本",
    "abstractDeadline": "締切済",
    "earlyBirdDeadline": "締切済",
    "officialUrl": "https://www.congre.co.jp/130jos/index.html",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "closed",
      "startDate": null,
      "deadline": null,
      "url": "https://www.congre.co.jp/130jos/index.html"
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "日本眼科学会総会",
      "基幹学会",
      "福岡開催",
      "専門医単位"
    ],
    "description": "春の日本眼科学会年次総会。基礎・臨床の全領域にわたるシンポジウムおよび一般演題発表。",
    "isConference": true
  },
  {
    "id": "conf-jp-perimetry-2026",
    "title": "第38回 日本視野画像学会学術集会",
    "subtitle": "視野検査と最先端画像診断のフロンティア",
    "date": "2026-05-16",
    "endDate": "2026-05-17",
    "time": "全日程",
    "region": "関東",
    "venue": "東京慈恵会医科大学 講堂",
    "specialty": "その他",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本視野画像学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "その他",
    "conferenceTier": "subspecialty",
    "period": "2026年5月16日(土) 〜 5月17日(日)",
    "cityCountry": "東京都 / 日本",
    "abstractDeadline": "締切済",
    "earlyBirdDeadline": "締切済",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "closed",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "視野検査",
      "OCT画像解析",
      "緑内障視野",
      "AI画像診断"
    ],
    "description": "静的動的視野解析、OCT/OCTA画像診断、緑内障・神経眼科疾患の機能構造連関を検討。",
    "isConference": true
  },
  {
    "id": "oph-008",
    "title": "第13回 日本眼形成再建外科学会学術集会 (JSOPRS 2026)",
    "subtitle": "眼形成再建の技術革新とエビデンス",
    "date": "2026-06-20",
    "endDate": "2026-06-21",
    "time": "全日程",
    "region": "四国",
    "venue": "高知県立県民文化ホール グリーンホール",
    "specialty": "眼形成",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本眼形成再建外科学会",
    "credits": "日本眼科学会 4単位 / 形成外科学会後援",
    "conferenceRegion": "domestic",
    "conferenceCategory": "形成腫瘍",
    "conferenceTier": "subspecialty",
    "period": "2026年6月20日(土) 〜 6月21日(日)",
    "cityCountry": "高知市（高知県） / 日本",
    "abstractDeadline": "締切済",
    "earlyBirdDeadline": "締切済",
    "officialUrl": "https://jsoprs2026.com/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "closed",
      "startDate": "2026-06-01",
      "deadline": "2026-07-31 17:00",
      "url": "https://jsoprs2026.com/"
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "眼瞼下垂",
      "ミュラー筋短縮",
      "眼窩減圧術",
      "現地開催"
    ],
    "description": "眼形成再建外科分野の年次学術集会。眼瞼下垂・挙筋腱膜前転術、ミュラー筋タッキング、眼窩再建手技の供覧。",
    "isConference": true
  },
  {
    "id": "oph-008-s1",
    "parentConferenceId": "oph-008",
    "title": "【JSOPRS 2026】共催セミナー1：眼瞼痙攣に対するボツリヌス療法と手術療法のハイブリッド戦略",
    "subtitle": "難治例における眼輪筋切除術と施注テクニックの最適化",
    "date": "2026-06-20",
    "endDate": "2026-06-20",
    "time": "12:00 - 13:00",
    "region": "四国",
    "venue": "高知県立県民文化ホール 第1会場",
    "specialty": "眼形成",
    "eventType": "講演会・勉強会",
    "format": "現地",
    "sponsor": "第13回日本眼形成再建外科学会 / グラクソ・スミスクライン株式会社",
    "credits": "日本眼科学会 1単位",
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "officialUrl": "https://jsoprs2026.com/",
    "pdfUrl": "jsoprs2026_symposium1.pdf",
    "tags": [
      "共催セミナー",
      "ボツリヌス治療",
      "眼瞼痙攣",
      "JSOPRS共催"
    ],
    "description": "第13回日本眼形成再建外科学会 共催セミナー。ボツリヌス毒素A療法の効果減弱時の対応と、眼瞼形成術・外科的治療の併用戦略。",
    "isConference": false,
    "cityCountry": "高知市（高知県） / 日本",
    "period": "2026年6月20日(土) 12:00 - 13:00"
  },
  {
    "id": "conf-jp-lowvision-2026",
    "title": "第27回 日本ロービジョン学会学術総会",
    "subtitle": "見えにくさを支える医療・教育・福祉の包括的アプローチ",
    "date": "2026-09-19",
    "endDate": "2026-09-21",
    "time": "全日程",
    "region": "九州・沖縄",
    "venue": "宮崎大学錦本町ひなたキャンパス",
    "specialty": "その他",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本ロービジョン学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "ロービジョン",
    "conferenceTier": "subspecialty",
    "period": "2026年9月19日(土) 〜 9月21日(月・祝)",
    "cityCountry": "宮崎市（宮崎県） / 日本",
    "abstractDeadline": "締切済",
    "earlyBirdDeadline": "締切済",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "closed",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "ロービジョンケア",
      "視覚補助具",
      "スマートグラス",
      "生活支援"
    ],
    "description": "視覚障害者支援、拡大読書器・デジタル技術の活用、多職種連携を議論。",
    "isConference": true
  },
  {
    "id": "conf-int-euretina-2026",
    "title": "EURETINA 2026 (26th EURETINA Congress)",
    "subtitle": "European Society of Retina Specialists Annual Meeting",
    "date": "2026-10-01",
    "endDate": "2026-10-04",
    "time": "現地時間",
    "region": "海外",
    "venue": "Messe Wien Exhibition & Congress Center",
    "venueId": "messe-wien",
    "specialty": "網膜・硝子体",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "European Society of Retina Specialists",
    "credits": "EACCME Credits / 国際単位",
    "conferenceRegion": "international",
    "conferenceCategory": "網膜硝子体",
    "conferenceTier": "primary",
    "period": "2026年10月1日(木) 〜 10月4日(日)",
    "cityCountry": "ウィーン / オーストリア",
    "abstractDeadline": "締切済",
    "earlyBirdDeadline": "締切済",
    "officialUrl": "https://euretina.org/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "",
    "abstractSubmission": {
      "status": "closed",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "EURETINA",
      "欧州網膜学会",
      "国際学会",
      "黄斑変性"
    ],
    "description": "世界屈指の規模を誇る欧州網膜硝子体学会年次学術総会。",
    "isConference": true
  },
  {
    "id": "conf-jp-glaucoma-2026",
    "title": "第37回 日本緑内障学会",
    "subtitle": "緑内障診療の深耕と未来開拓",
    "date": "2026-10-02",
    "endDate": "2026-10-04",
    "time": "全日程",
    "region": "中部",
    "venue": "静岡県コンベンションアーツセンター グランシップ",
    "specialty": "緑内障",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本緑内障学会",
    "credits": "日本眼科学会生涯教育単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "緑内障",
    "conferenceTier": "subspecialty",
    "period": "2026年10月2日(金) 〜 10月4日(日)",
    "cityCountry": "静岡市（静岡県） / 日本",
    "abstractDeadline": "締切済",
    "earlyBirdDeadline": "締切済",
    "officialUrl": "https://www.ryokunaisho.jp/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "closed",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "緑内障",
      "MIGS",
      "眼圧管理",
      "神経保護"
    ],
    "description": "緑内障の基礎研究から薬物治療・低侵襲手術(MIGS)・濾過手術まで最新知見を網羅。",
    "isConference": true
  },
  {
    "id": "oph-004",
    "title": "AAO 2026 Annual Meeting (American Academy of Ophthalmology)",
    "subtitle": "Where all of ophthalmology meets",
    "date": "2026-10-10",
    "endDate": "2026-10-12",
    "time": "08:00 - 17:30 (現地時間)",
    "region": "海外",
    "venue": "Ernest N. Morial Convention Center, New Orleans, LA",
    "venueId": "new-orleans-convention-center",
    "specialty": "一般眼科",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "American Academy of Ophthalmology",
    "credits": "AMA PRA Category 1 Credits / 国際眼科学会認定",
    "conferenceRegion": "international",
    "conferenceCategory": "総合",
    "conferenceTier": "primary",
    "period": "2026年10月10日(土) 〜 10月12日(月)",
    "cityCountry": "ニューオーリンズ（ルイジアナ州） / 米国",
    "abstractDeadline": "締切済",
    "earlyBirdDeadline": "締切済",
    "officialUrl": "https://www.aao.org/annual-meeting",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "",
    "abstractSubmission": {
      "status": "closed",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "AAO",
      "米国眼科学会",
      "最大規模",
      "国際学会"
    ],
    "description": "世界最大の眼科学会年次集会。全サブスペシャリティの最新潮流が集結。",
    "isConference": true
  },
  {
    "id": "oph-002",
    "title": "緑内障薬物治療Update 〜配合点眼薬とSLTのポジショニング〜",
    "subtitle": "目標眼圧達成率の向上とアドヒアランス改善を目指す最新エビデンス",
    "date": "2026-10-15",
    "endDate": "2026-10-15",
    "time": "19:00 - 20:30",
    "region": "全国Web",
    "venue": "Zoomウェビナー（オンラインライブ配信）",
    "specialty": "緑内障",
    "eventType": "講演会・勉強会",
    "format": "Web",
    "sponsor": "日本緑内障先端治療研究会 / 眼科メディカルファーマ",
    "credits": "日本眼科学会生涯教育 1単位",
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "officialUrl": "https://example.com/glaucoma-webinar-oct",
    "pdfUrl": "glaucoma_update_2026.pdf",
    "tags": [
      "点眼指導",
      "SLT",
      "Webセミナー",
      "専門医単位"
    ],
    "description": "早期〜中期緑内障における第一選択薬の使い分けと、防腐剤フリー点眼薬の角膜上皮への影響、SLT導入のベストタイミングを検証。",
    "isConference": false
  },
  {
    "id": "oph-001",
    "title": "第80回 日本臨床眼科学会 (臨眼 2026)",
    "subtitle": "臨床眼科80年の軌跡と新次元への跳躍",
    "date": "2026-10-29",
    "endDate": "2026-11-01",
    "time": "09:00 - 18:00 (全日程)",
    "region": "関西",
    "venue": "国立京都国際会館、ザ・プリンス 京都宝ヶ池",
    "specialty": "一般眼科",
    "eventType": "国内学会",
    "format": "ハイブリッド",
    "sponsor": "公益財団法人 日本眼科学会 / 日本眼科医会",
    "credits": "日本眼科学会生涯教育 8単位 / 専門医制度認定",
    "conferenceRegion": "domestic",
    "conferenceCategory": "総合",
    "conferenceTier": "primary",
    "period": "2026年10月29日(木) 〜 11月1日(日)",
    "cityCountry": "京都市（京都府） / 日本",
    "abstractDeadline": "締切済",
    "earlyBirdDeadline": "2026年8月31日(月) 締切済",
    "officialUrl": "https://convention.jtbcom.co.jp/80ringan/index.html",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "closed",
      "startDate": null,
      "deadline": null,
      "url": "https://convention.jtbcom.co.jp/80ringan/index.html"
    },
    "calendarStatus": {
      "google": {
        "status": "partial",
        "conflicts": [
          {
            "start": "13:00",
            "end": "17:00",
            "title": "外来手術枠"
          }
        ]
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "国内最大規模",
      "臨床眼科",
      "シンポジウム",
      "機器展示",
      "専門医単位"
    ],
    "description": "国内最大規模の眼科学術集会。全サブスペシャリティの最新実臨床知見が集結。",
    "isConference": true
  },
  {
    "id": "oph-003",
    "title": "第35回 日本小児眼科学会・日本弱視斜視学会 合同学会",
    "subtitle": "視覚発達の臨界期を見据えた早期診断と最新の視能矯正アプローチ",
    "date": "2026-10-30",
    "endDate": "2026-11-02",
    "time": "09:00 - 17:30 (全日程)",
    "region": "関東",
    "venue": "パシフィコ横浜 会議センター（神奈川県横浜市）",
    "specialty": "小児・斜視弱視",
    "eventType": "国内学会",
    "format": "ハイブリッド",
    "sponsor": "日本小児眼科学会 / 日本弱視斜視学会",
    "credits": "日本眼科学会生涯教育 6単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "小児斜視",
    "conferenceTier": "subspecialty",
    "period": "2026年10月30日(金) 〜 11月2日(月)",
    "cityCountry": "横浜市（神奈川県） / 日本",
    "abstractDeadline": "締切済",
    "earlyBirdDeadline": "2026年9月15日(火) 締切済",
    "officialUrl": "https://example.com/jasp-jsas-2026",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "closed",
      "startDate": "2026-05-01",
      "deadline": "2026-06-30 17:00",
      "url": "https://example.com/jasp-jsas-2026/abstract"
    },
    "calendarStatus": {
      "google": {
        "status": "busy",
        "conflicts": [
          {
            "start": "14:00",
            "end": "17:00",
            "title": "休日当番医"
          }
        ]
      },
      "icloud": {
        "status": "partial",
        "conflicts": [
          {
            "start": "16:00",
            "end": "18:00",
            "title": "家族送迎"
          }
        ]
      },
      "isAdded": false
    },
    "tags": [
      "合同学会",
      "弱視斜視",
      "視能矯正",
      "月またぎ会期"
    ],
    "description": "2学会合同で開催される年次学術集会。乳幼児屈折異常スクリーニングと斜視手術を網羅。",
    "isConference": true
  },
  {
    "id": "oph-001-s1",
    "parentConferenceId": "oph-001",
    "title": "【臨眼2026】ランチョンセミナー12：難治性黄斑疾患に対する抗VEGF治療の新展開",
    "subtitle": "広角OCTAとバイオマーカーに基づく投与間隔延長プロトコル",
    "date": "2026-10-30",
    "endDate": "2026-10-30",
    "time": "12:20 - 13:20",
    "region": "関西",
    "venue": "国立京都国際会館 第2会場（Room B-1）",
    "specialty": "網膜・硝子体",
    "eventType": "講演会・勉強会",
    "format": "現地",
    "sponsor": "第80回日本臨床眼科学会 / ノバルティス ファーマ株式会社",
    "sponsors": [{ "companyId": "novartis", "role": "co-sponsor" }],
    "credits": "日本眼科学会生涯教育 1単位",
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "officialUrl": "https://convention.jtbcom.co.jp/80ringan/index.html",
    "pdfUrl": "ringan2026_luncheon12.pdf",
    "tags": [
      "ランチョンセミナー",
      "抗VEGF",
      "黄斑変性",
      "臨眼2026共催"
    ],
    "description": "第80回日本臨床眼科学会 ランチョンセミナー。滲出型加齢黄斑変性およびPCVに対する高用量抗VEGF抗体の長期治療成績とtreat-and-extendレジメンの実際。",
    "isConference": false
  },
  {
    "id": "oph-001-s2",
    "parentConferenceId": "oph-001",
    "title": "【臨眼2026】モーニングセミナー3：緑内障手術ナビゲーション 〜低侵襲緑内障手術(MIGS)の極意〜",
    "subtitle": "線維柱帯切開術マイクロフックとステント留置術の使い分け",
    "date": "2026-10-31",
    "endDate": "2026-10-31",
    "time": "07:50 - 08:40",
    "region": "関西",
    "venue": "国立京都国際会館 第5会場（Room D）",
    "specialty": "緑内障",
    "eventType": "講演会・勉強会",
    "format": "現地",
    "sponsor": "第80回日本臨床眼科学会 / 参天製薬株式会社",
    "sponsors": [{ "companyId": "santen", "role": "co-sponsor" }],
    "credits": "日本眼科学会生涯教育 1単位",
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "officialUrl": "https://convention.jtbcom.co.jp/80ringan/index.html",
    "pdfUrl": "ringan2026_morning3.pdf",
    "tags": [
      "モーニングセミナー",
      "MIGS",
      "緑内障手術",
      "臨眼2026共催"
    ],
    "description": "第80回日本臨床眼科学会 モーニングセミナー。流出路再建術におけるマイクロフックトラベクロトミーの手技と周術期眼圧管理。",
    "isConference": false
  },
  {
    "id": "oph-001-s3",
    "parentConferenceId": "oph-001",
    "title": "【臨眼2026】イブニングセミナー5：極小切開白内障手術と最新IOL固定手技",
    "subtitle": "強膜内固定術(Yamane法)のトラブルシューティングと長期予後",
    "date": "2026-10-31",
    "endDate": "2026-10-31",
    "time": "17:30 - 18:30",
    "region": "関西",
    "venue": "国立京都国際会館 第1会場（Main Hall）",
    "specialty": "白内障",
    "eventType": "講演会・勉強会",
    "format": "現地",
    "sponsor": "第80回日本臨床眼科学会 / アルコン ファーマ株式会社",
    "credits": "日本眼科学会生涯教育 1単位",
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "officialUrl": "https://convention.jtbcom.co.jp/80ringan/index.html",
    "pdfUrl": "ringan2026_evening5.pdf",
    "tags": [
      "イブニングセミナー",
      "強膜内固定",
      "Yamane法",
      "臨眼2026共催"
    ],
    "description": "第80回日本臨床眼科学会 イブニングセミナー。チン小帯脆弱例・IOL偏位に対するダブルニードル法による毛様溝強膜内固定の工夫と合併症対策。",
    "isConference": false
  },
  {
    "id": "conf-jp-pharmacology-2026",
    "title": "第46回 日本眼薬理学会",
    "subtitle": "眼科創薬の新展開とドラッグデリバリーシステム",
    "date": "2026-11-07",
    "endDate": "2026-11-08",
    "time": "全日程",
    "region": "中部",
    "venue": "じゅうろくプラザ（岐阜市文化産業交流センター）",
    "specialty": "その他",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本眼薬理学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "その他",
    "conferenceTier": "subspecialty",
    "period": "2026年11月7日(土) 〜 11月8日(日)",
    "cityCountry": "岐阜市（岐阜県） / 日本",
    "abstractDeadline": "締切済",
    "earlyBirdDeadline": "締切済",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "closed",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "眼薬理",
      "DDS",
      "点眼薬開発",
      "網膜神経保護"
    ],
    "description": "眼科薬物療法の基盤研究、点眼剤・徐放デバイス開発の最前線。",
    "isConference": true
  },
  {
    "id": "oph-005",
    "title": "プレミアムIOL徹底攻略：老視矯正と乱視軸合わせの極意",
    "subtitle": "3焦点・EDOFレンズの適応判断とAngle Kappa・角膜高次収差の評価",
    "date": "2026-11-07",
    "endDate": "2026-11-07",
    "time": "15:00 - 18:00",
    "region": "中部",
    "venue": "名古屋ミッドランドスクエア 会議室 / ライブ配信",
    "specialty": "白内障",
    "eventType": "講演会・勉強会",
    "format": "ハイブリッド",
    "sponsor": "中部屈折矯正白内障手術懇話会",
    "credits": "日本眼科学会生涯教育 1.5単位",
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": true
    },
    "officialUrl": "https://example.com/premium-iol-nagoya",
    "pdfUrl": "iol_masterclass_2026.pdf",
    "tags": [
      "多焦点眼内レンズ",
      "屈折矯正",
      "乱視矯正",
      "カレンダー登録済"
    ],
    "description": "白内障手術における術後不満足を防ぐ術前カウセリング術。EDOF/多焦点IOLの光学特性比較とトーリック軸補正の実際。",
    "isConference": false
  },
  {
    "id": "oph-006",
    "title": "第37回 関西角膜・ドライアイ臨床研究会",
    "subtitle": "マイボーム腺機能不全(MGD)の新規治療と角膜移植(DMEK/DSAEK)の最前線",
    "date": "2026-11-14",
    "endDate": "2026-11-14",
    "time": "14:00 - 17:30",
    "region": "関西",
    "venue": "梅田スカイビル スペース36 / オンライン中継",
    "specialty": "角膜・外眼部",
    "eventType": "地方会・研究会",
    "format": "ハイブリッド",
    "sponsor": "近畿角膜疾患研究グループ",
    "credits": "日本眼科学会 2単位",
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "officialUrl": "https://example.com/kansai-cornea-37",
    "pdfUrl": "cornea_dryeye_kansai.pdf",
    "tags": [
      "DMEK",
      "ドライアイ",
      "内皮移植",
      "生体共焦点顕微鏡"
    ],
    "description": "重症ドライアイ・MGDに対するIPL治療の実際と、水疱性角膜症に対する内皮移植（DMEK/DSAEK）の低侵襲手技解説。",
    "isConference": false
  },
  {
    "id": "oph-007",
    "title": "小児眼科スクリーニングと斜視弱視治療の実際",
    "subtitle": "屈折検査機器(スポットビジョンスクリーナー)の活用と不同視弱視の完全屈折矯正",
    "date": "2026-11-21",
    "endDate": "2026-11-21",
    "time": "18:00 - 19:30",
    "region": "全国Web",
    "venue": "Web会議システム（Zoom）",
    "specialty": "小児・斜視弱視",
    "eventType": "講演会・勉強会",
    "format": "Web",
    "sponsor": "日本弱視斜視臨床懇話会",
    "credits": "日本眼科学会専門医 1単位",
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "partial",
        "conflicts": [
          {
            "start": "18:00",
            "end": "19:00",
            "title": "当直引継ぎミーティング"
          }
        ]
      },
      "isAdded": false
    },
    "officialUrl": "https://example.com/pediatric-strabismus-web",
    "pdfUrl": "pediatric_ophth_guide.pdf",
    "tags": [
      "3歳児健診",
      "屈折異常",
      "アイパッチ遮閉",
      "専門医単位"
    ],
    "description": "乳幼児健診での弱視見逃しを防ぐフォトスクリーナーの導入効果と、アトロピン点眼・遮閉訓練の実践的プロトコル。",
    "isConference": false
  },
  {
    "id": "conf-jp-neuro-2026",
    "title": "第64回 日本神経眼科学会総会",
    "subtitle": "視覚路・眼球運動障害の解剖と最先端臨床",
    "date": "2026-11-26",
    "endDate": "2026-11-27",
    "time": "全日程",
    "region": "関東",
    "venue": "ロイヤルホールヨコハマ",
    "specialty": "神経眼科",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本神経眼科学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "神経眼科",
    "conferenceTier": "subspecialty",
    "period": "2026年11月26日(木) 〜 11月27日(金)",
    "cityCountry": "横浜市（神奈川県） / 日本",
    "abstractDeadline": "締切済",
    "earlyBirdDeadline": "締切済",
    "officialUrl": "http://www.shinkeiganka.com/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "closed",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "視神経炎",
      "MOGAD",
      "複視",
      "瞳孔異常"
    ],
    "description": "視神経疾患、眼球運動障害、中枢性視覚異常の診断と治療。",
    "isConference": true
  },
  {
    "id": "conf-jp-jrvs-2026",
    "venueId": "tokyo-international-forum",
    "title": "第65回 日本網膜硝子体学会総会",
    "subtitle": "網膜硝子体疾患の病態解明と外科・内科的治療革新",
    "date": "2026-12-04",
    "endDate": "2026-12-06",
    "time": "全日程",
    "region": "関東",
    "venue": "東京国際フォーラム",
    "specialty": "網膜・硝子体",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本網膜硝子体学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "網膜硝子体",
    "conferenceTier": "subspecialty",
    "period": "2026年12月4日(金) 〜 12月6日(日)",
    "cityCountry": "千代田区（東京都） / 日本",
    "abstractDeadline": "締切済",
    "earlyBirdDeadline": "締切済",
    "officialUrl": "https://www.jrvs.jp/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "Asia Retina Congress (ARC) 併催",
    "abstractSubmission": {
      "status": "closed",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "網膜硝子体手術",
      "加齢黄斑変性",
      "糖尿病網膜症",
      "ARC併催"
    ],
    "description": "国内最大の網膜専門学会。最新の手術手技および抗VEGF療法エビデンス。",
    "isConference": true
  },
  {
    "id": "conf-int-arc-2026",
    "title": "Asia Retina Congress 2026 (ARC 2026)",
    "subtitle": "Advancing Vitreoretinal Care Across the Asia-Pacific",
    "date": "2026-12-05",
    "endDate": "2026-12-06",
    "time": "全日程",
    "region": "関東",
    "venue": "東京国際フォーラム",
    "specialty": "網膜・硝子体",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "Asia Retina Congress",
    "credits": "国際単位認定",
    "conferenceRegion": "international",
    "conferenceCategory": "網膜硝子体",
    "conferenceTier": "subspecialty",
    "period": "2026年12月5日(土) 〜 12月6日(日)",
    "cityCountry": "東京都 / 日本",
    "abstractDeadline": "締切済",
    "earlyBirdDeadline": "締切済",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "日本網膜硝子体学会総会併催",
    "abstractSubmission": {
      "status": "closed",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "ARC",
      "アジア網膜学会",
      "日本網膜硝子体学会併催",
      "国際学会"
    ],
    "description": "アジア太平洋地域の網膜専門医が東京に集う国際カンファレンス。",
    "isConference": true
  },
  {
    "id": "oph-009",
    "title": "神経眼科ケースカンファレンス：見落としてはならない視神経疾患",
    "subtitle": "MOGAD/NMOSD関連視神経炎と虚血性視神経症(AION)の鑑別ポイント",
    "date": "2026-12-10",
    "endDate": "2026-12-10",
    "time": "19:15 - 20:45",
    "region": "関東",
    "venue": "TKP東京駅カンファレンスセンター / Web同時配信",
    "specialty": "神経眼科",
    "eventType": "地方会・研究会",
    "format": "ハイブリッド",
    "sponsor": "首都圏神経眼科研究会",
    "credits": "日本眼科学会生涯教育 1単位",
    "calendarStatus": {
      "google": {
        "status": "busy",
        "conflicts": [
          {
            "start": "19:30",
            "end": "21:00",
            "title": "院内安全管理委員会"
          }
        ]
      },
      "icloud": {
        "status": "partial",
        "conflicts": [
          {
            "start": "19:00",
            "end": "20:00",
            "title": "医局抄読会"
          }
        ]
      },
      "isAdded": false
    },
    "officialUrl": "https://example.com/neuro-oph-case-conf",
    "pdfUrl": "neuro_ophthalmology_case.pdf",
    "tags": [
      "抗MOG抗体",
      "視神経乳頭浮腫",
      "MRI画像診断",
      "ステロイドパルス"
    ],
    "description": "急速な視力低下・視野欠損をきたす視神経炎の迅速な画像診断と抗体検査オーダーのタイミング、最新免疫療法を症例検討形式で解説。",
    "isConference": false
  },
  {
    "id": "oph-010",
    "title": "APACRS 2026 (Asia-Pacific Association of Cataract & Refractive Surgeons)",
    "subtitle": "Precision and Artistry in Anterior Segment Surgery",
    "date": "2026-12-17",
    "endDate": "2026-12-20",
    "time": "08:30 - 18:00 (現地時間)",
    "region": "海外",
    "venue": "Suntec Singapore Convention & Exhibition Centre",
    "venueId": "suntec-singapore",
    "specialty": "白内障",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "Asia-Pacific Association of Cataract and Refractive Surgeons",
    "credits": "APACRS CME Credits / 国際単位",
    "conferenceRegion": "international",
    "conferenceCategory": "白内障屈折",
    "conferenceTier": "primary",
    "abstractSubmission": {
      "status": "closed",
      "startDate": "2026-06-01",
      "deadline": "2026-08-10 23:59",
      "url": "https://example.com/apacrs2026/abstracts"
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "officialUrl": "https://example.com/apacrs2026-singapore",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "pdfUrl": "apacrs2026_singapore.pdf",
    "tags": [
      "アジア太平洋学会",
      "前眼部手術",
      "フェムトセカンドレーザー",
      "IOL脱臼"
    ],
    "description": "アジア太平洋地域の白内障屈折手術学会。難症例白内障への対処法と最新レーザー手技。",
    "isConference": true,
    "period": "2026年12月17日(木) 〜 12月20日(日)",
    "cityCountry": "シンガポール / シンガポール共和国",
    "abstractDeadline": "2026年8月10日(月) 締切済",
    "earlyBirdDeadline": "2026年10月31日(土) まで受付中"
  },
  {
    "id": "conf-jp-presbyopia-2027",
    "title": "第4回 日本老視学会学術総会",
    "subtitle": "老視矯正のサイエンスと臨床実践",
    "date": "2027-01-16",
    "endDate": "2027-01-17",
    "time": "全日程",
    "region": "関東",
    "venue": "御茶ノ水ソラシティカンファレンスセンター",
    "specialty": "白内障",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本老視学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "白内障屈折",
    "conferenceTier": "subspecialty",
    "period": "2027年1月16日(土) 〜 1月17日(日)",
    "cityCountry": "東京都 / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "老視",
      "多焦点眼内レンズ",
      "調節機能",
      "点眼治療"
    ],
    "description": "老眼に対する水晶体再建術、点眼薬、調節機能解析の最新トピックス。",
    "isConference": true
  },
  {
    "id": "conf-jp-surgery-2027",
    "title": "第50回 日本眼科手術学会学術総会",
    "subtitle": "眼科手術の集大成と次世代への継承",
    "date": "2027-01-29",
    "endDate": "2027-01-31",
    "time": "全日程",
    "region": "関東",
    "venue": "東京国際フォーラム",
    "specialty": "その他",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本眼科手術学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "その他",
    "conferenceTier": "subspecialty",
    "period": "2027年1月29日(金) 〜 1月31日(日)",
    "cityCountry": "千代田区（東京都） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "https://50.jsos.jp/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": "https://50.jsos.jp/"
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "眼科手術",
      "白内障手術",
      "硝子体手術",
      "緑内障手術",
      "ビデオシンポジウム"
    ],
    "description": "白内障・網膜・緑内障・角膜・眼形成まで全領域の手術手技が集う年次学術集会。",
    "isConference": true
  },
  {
    "id": "conf-jp-cornea-2027",
    "title": "角膜カンファランス2027",
    "subtitle": "南の風に乗る角膜診療のフロンティア",
    "date": "2027-02-11",
    "endDate": "2027-02-13",
    "time": "全日程",
    "region": "九州・沖縄",
    "venue": "沖縄コンベンションセンター",
    "specialty": "角膜・外眼部",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本角膜学会 / 日本角膜移植学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "角膜",
    "conferenceTier": "subspecialty",
    "period": "2027年2月11日(木・祝) 〜 2月13日(土)",
    "cityCountry": "宜野湾市（沖縄県） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "第51回日本角膜学会総会・第43回日本角膜移植学会",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "角膜カンファランス",
      "角膜内皮",
      "円錐角膜",
      "再生医療"
    ],
    "description": "角膜移植手技、角膜内皮再生医療、重症ドライアイの最前線。",
    "isConference": true
  },
  {
    "id": "conf-jp-eyelid-2027",
    "title": "第38回 日本眼瞼義眼床手術学会学術集会",
    "subtitle": "眼瞼・義眼床手術の新たなスタンダード",
    "date": "2027-02-13",
    "endDate": "2027-02-14",
    "time": "全日程",
    "region": "未定",
    "venue": "未定",
    "specialty": "眼形成",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本眼瞼義眼床手術学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "形成腫瘍",
    "conferenceTier": "subspecialty",
    "period": "2027年2月（予定）",
    "cityCountry": "未定 / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": ""
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "眼瞼手術",
      "義眼床",
      "形成外科連携"
    ],
    "description": "眼科医・形成外科医・義眼技師が協働し、眼瞼下垂や義眼床難症例の再建手術を討議。",
    "isConference": true
  },
  {
    "id": "conf-jp-diabetic-2027",
    "title": "第33回 日本糖尿病眼学会総会",
    "subtitle": "糖尿病眼合併症の包括的予防と最新治療戦略",
    "date": "2027-03-12",
    "endDate": "2027-03-13",
    "time": "全日程",
    "region": "中部",
    "venue": "ホテル金沢",
    "specialty": "網膜・硝子体",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本糖尿病眼学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "網膜硝子体",
    "conferenceTier": "subspecialty",
    "period": "2027年3月12日(金) 〜 3月13日(土)",
    "cityCountry": "金沢市（石川県） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "糖尿病網膜症",
      "糖尿病黄斑浮腫",
      "全身管理",
      "抗VEGF"
    ],
    "description": "糖尿病網膜症・黄斑浮腫の病態解明、早期発見、内科連携を議論。",
    "isConference": true
  },
  {
    "id": "conf-jp-iscev-2027",
    "title": "第75回 日本臨床視覚電気生理学会",
    "subtitle": "視覚電気生理の臨床応用と次世代機能評価",
    "date": "2027-03-12",
    "endDate": "2027-03-13",
    "time": "全日程",
    "region": "東北",
    "venue": "リンクステーションホール青森",
    "specialty": "その他",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本臨床視覚電気生理学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "その他",
    "conferenceTier": "subspecialty",
    "period": "2027年3月12日(金) 〜 3月13日(土)",
    "cityCountry": "青森市（青森県） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "ERG",
      "網膜電図",
      "視覚誘発電位",
      "遺伝性網膜疾患"
    ],
    "description": "ERG・VEPによる網膜・視覚伝導路の客観的機能検査と遺伝性網膜ジストロフィ診断。",
    "isConference": true
  },
  {
    "id": "conf-int-apao-2027",
    "title": "APAO 2027 (42nd Asia-Pacific Academy of Ophthalmology Congress)",
    "subtitle": "Vision for the Future in the Asia-Pacific",
    "date": "2027-03-18",
    "endDate": "2027-03-21",
    "time": "現地時間",
    "region": "海外",
    "venue": "Suntec Singapore Convention & Exhibition Centre",
    "venueId": "suntec-singapore",
    "specialty": "一般眼科",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "Asia-Pacific Academy of Ophthalmology",
    "credits": "国際単位認定",
    "conferenceRegion": "international",
    "conferenceCategory": "総合",
    "conferenceTier": "primary",
    "period": "2027年3月18日(木) 〜 3月21日(日)",
    "cityCountry": "シンガポール / シンガポール共和国",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "https://apaophth.org/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "APAO",
      "アジア太平洋眼科学会",
      "国際学会"
    ],
    "description": "アジア太平洋地域最大の眼科学術コングレス。",
    "isConference": true
  },
  {
    "id": "conf-int-fujiretina-2027",
    "title": "FujiRetina 2027",
    "subtitle": "The Premier International Retina Conference in Japan",
    "date": "2027-03-26",
    "endDate": "2027-03-28",
    "time": "全日程",
    "region": "関東",
    "venue": "東京国際フォーラム",
    "specialty": "網膜・硝子体",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "FujiRetina Organizing Committee",
    "credits": "国際単位認定",
    "conferenceRegion": "international",
    "conferenceCategory": "網膜硝子体",
    "conferenceTier": "subspecialty",
    "period": "2027年3月26日(金) 〜 3月28日(日)",
    "cityCountry": "東京都 / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "日本開催の国際網膜カンファレンス",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "FujiRetina",
      "国際網膜会議",
      "日本開催"
    ],
    "description": "世界のトップサージョン・研究者が東京に集う国際網膜シンポジウム。",
    "isConference": true
  },
  {
    "id": "conf-int-ascrs-2027",
    "title": "ASCRS 2027 Annual Meeting",
    "subtitle": "American Society of Cataract and Refractive Surgery",
    "date": "2027-04-02",
    "endDate": "2027-04-05",
    "time": "現地時間",
    "region": "海外",
    "venue": "San Diego Convention Center, San Diego, CA",
    "specialty": "白内障",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "American Society of Cataract and Refractive Surgery",
    "credits": "CME Credits / 国際単位",
    "conferenceRegion": "international",
    "conferenceCategory": "白内障屈折",
    "conferenceTier": "primary",
    "period": "2027年4月2日(金) 〜 4月5日(月)",
    "cityCountry": "サンディエゴ（カリフォルニア州） / 米国",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "https://ascrs.org/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "ASCRS",
      "米国白内障屈折手術学会",
      "国際学会"
    ],
    "description": "米国最大の前眼部・白内障・屈折矯正手術学会。",
    "isConference": true
  },
  {
    "id": "oph-011",
    "title": "第131回 日本眼科学会総会",
    "subtitle": "眼科学の見渡す限り",
    "date": "2027-04-15",
    "endDate": "2027-04-18",
    "time": "全日程（全プログラム現地開催）",
    "region": "北海道",
    "venue": "グランドメルキュール札幌大通公園、札幌プリンスホテル国際館パミール、札幌市教育文化会館",
    "specialty": "一般眼科",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "公益財団法人 日本眼科学会",
    "credits": "日本眼科学会生涯教育 10単位 / 専門医認定",
    "conferenceRegion": "domestic",
    "conferenceCategory": "総合",
    "conferenceTier": "primary",
    "period": "2027年4月15日(木) 〜 4月18日(日)",
    "cityCountry": "札幌市（北海道） / 日本",
    "abstractDeadline": "2026年11月5日(木) 13:00 (募集中)",
    "earlyBirdDeadline": "未定",
    "officialUrl": "https://convention.jtbcom.co.jp/131jos/index.html",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "総会長: 石田 晋 教授（北海道大学）",
    "abstractSubmission": {
      "status": "open",
      "startDate": "2026-10-01",
      "deadline": "2026-11-05 13:00",
      "url": "https://convention.jtbcom.co.jp/131jos/abstract/index.html"
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "日本眼科学会総会",
      "基幹学会",
      "演題募集中",
      "現地開催",
      "専門医単位"
    ],
    "description": "日本眼科学会の年次総会。基礎研究から最新臨床まで眼科学の全領域を見渡す最高峰の学術集会。",
    "isConference": true
  },
  {
    "id": "oph-014",
    "venueId": "kyoto-international-conference-center",
    "title": "第38回 日本緑内障学会",
    "subtitle": "World Glaucoma Congress (WGC 2027) 併催",
    "date": "2027-04-20",
    "endDate": "2027-04-23",
    "time": "全日程",
    "region": "関西",
    "venue": "国立京都国際会館",
    "specialty": "緑内障",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本緑内障学会",
    "credits": "日本眼科学会生涯教育単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "緑内障",
    "conferenceTier": "subspecialty",
    "period": "2027年4月20日(火) 〜 4月23日(金)",
    "cityCountry": "京都市（京都府） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "World Glaucoma Congress (WGC 2027) 併催",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "緑内障",
      "WGC併催",
      "国際共同",
      "MIGS"
    ],
    "description": "世界緑内障コングレス(WGC)と併催される歴史的学術集会。",
    "isConference": true
  },
  {
    "id": "conf-int-wgc-2027",
    "title": "World Glaucoma Congress 2027 (WGC 2027)",
    "subtitle": "World Glaucoma Association (WGA)",
    "date": "2027-04-20",
    "endDate": "2027-04-23",
    "time": "全日程",
    "region": "関西",
    "venue": "国立京都国際会館",
    "specialty": "緑内障",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "World Glaucoma Association / 日本緑内障学会",
    "credits": "CME Credits / 国際単位",
    "conferenceRegion": "international",
    "conferenceCategory": "緑内障",
    "conferenceTier": "primary",
    "period": "2027年4月20日(火) 〜 4月23日(金)",
    "cityCountry": "京都市（京都府） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "https://worldglaucomacongress.org/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "日本緑内障学会併催 / 京都開催",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "WGC",
      "世界緑内障会議",
      "日本開催",
      "京都国際会館"
    ],
    "description": "世界の緑内障専門医が一堂に会する最高峰の国際コングレス。",
    "isConference": true
  },
  {
    "id": "oph-012",
    "title": "ARVO 2027 Annual Meeting",
    "subtitle": "The Association for Research in Vision and Ophthalmology",
    "date": "2027-05-02",
    "endDate": "2027-05-06",
    "time": "現地時間",
    "region": "海外",
    "venue": "San Diego Convention Center, San Diego, CA",
    "specialty": "一般眼科",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "The Association for Research in Vision and Ophthalmology",
    "credits": "CME Credits / 国際眼科学会認定",
    "conferenceRegion": "international",
    "conferenceCategory": "総合",
    "conferenceTier": "primary",
    "period": "2027年5月2日(日) 〜 5月6日(木)",
    "cityCountry": "サンディエゴ（カリフォルニア州） / 米国",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "https://www.arvo.org/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "ARVO",
      "視覚研究",
      "基礎研究",
      "最大規模国際学会"
    ],
    "description": "世界最大の基礎・臨床視覚科学研究年次総会。",
    "isConference": true
  },
  {
    "id": "conf-jp-lowvision-2027",
    "venueId": "osaka-international-convention-center",
    "title": "第28回 日本ロービジョン学会学術総会",
    "subtitle": "共生社会の実現に向けたロービジョンケアの深化",
    "date": "2027-05-22",
    "endDate": "2027-05-23",
    "time": "全日程",
    "region": "関西",
    "venue": "大阪国際会議場（グランキューブ大阪）",
    "specialty": "その他",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本ロービジョン学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "ロービジョン",
    "conferenceTier": "subspecialty",
    "period": "2027年5月22日(土) 〜 5月23日(日)",
    "cityCountry": "大阪市（大阪府） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "ロービジョン",
      "福祉機器",
      "視覚リハビリテーション"
    ],
    "description": "視覚障害者の自立支援、最新支援技術、医療と福祉の架け橋。",
    "isConference": true
  },
  {
    "id": "conf-int-apacrs-2027",
    "title": "APACRS 2027 Annual Meeting",
    "subtitle": "Asia-Pacific Association of Cataract & Refractive Surgeons",
    "date": "2027-06-03",
    "endDate": "2027-06-05",
    "time": "現地時間",
    "region": "海外",
    "venue": "Bali Nusa Dua Convention Center, Bali",
    "specialty": "白内障",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "APACRS",
    "credits": "国際単位認定",
    "conferenceRegion": "international",
    "conferenceCategory": "白内障屈折",
    "conferenceTier": "subspecialty",
    "period": "2027年6月3日(木) 〜 6月5日(土)",
    "cityCountry": "バリ / インドネシア",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "https://apacrs.org/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "APACRS",
      "白内障屈折",
      "アジア太平洋"
    ],
    "description": "アジア太平洋地域の白内障屈折手術学術集会。",
    "isConference": true
  },
  {
    "id": "conf-jp-perimetry-2027",
    "title": "第39回 日本視野画像学会学術集会",
    "subtitle": "構造と機能の次世代イメージング解析",
    "date": "2027-06-05",
    "endDate": "2027-06-06",
    "time": "全日程",
    "region": "関西",
    "venue": "大阪市中央公会堂",
    "specialty": "その他",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本視野画像学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "その他",
    "conferenceTier": "subspecialty",
    "period": "2027年6月5日(土) 〜 6月6日(日)",
    "cityCountry": "大阪市（大阪府） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "視野",
      "画像診断",
      "緑内障解析"
    ],
    "description": "視野検査手法と眼底イメージングの最新融合解析。",
    "isConference": true
  },
  {
    "id": "conf-jp-jsoprs-2027",
    "title": "第14回 日本眼形成再建外科学会学術集会 (JSOPRS 2027)",
    "subtitle": "機能美と解剖に立脚した眼形成再建外科学",
    "date": "2027-06-12",
    "endDate": "2027-06-13",
    "time": "全日程",
    "region": "九州・沖縄",
    "venue": "九州大学医学部 百年講堂",
    "specialty": "眼形成",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本眼形成再建外科学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "形成腫瘍",
    "conferenceTier": "subspecialty",
    "period": "2027年6月12日(土) 〜 6月13日(日)",
    "cityCountry": "福岡市（福岡県） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "http://www.jsoprs.jp/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": "http://www.jsoprs.jp/"
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "眼形成",
      "眼瞼下垂",
      "眼窩減圧",
      "再建外科"
    ],
    "description": "眼瞼・眼窩の手術解剖、低侵襲手技、難症例再建の供覧。",
    "isConference": true
  },
  {
    "id": "conf-jp-pediatric-2027",
    "title": "第83回 日本弱視斜視学会総会・第52回 日本小児眼科学会総会",
    "subtitle": "子どもの目の未来を守る：早期発見・最新治療・支援体制",
    "date": "2027-06-18",
    "endDate": "2027-06-19",
    "time": "全日程",
    "region": "東北",
    "venue": "天童ホテル",
    "specialty": "小児・斜視弱視",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本弱視斜視学会 / 日本小児眼科学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "小児斜視",
    "conferenceTier": "subspecialty",
    "period": "2027年6月18日(金) 〜 6月19日(土)",
    "cityCountry": "天童市（山形県） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "小児眼科",
      "弱視斜視",
      "視能矯正",
      "健診スクリーニング"
    ],
    "description": "小児眼疾患、斜視手術、弱視訓練、近視進行抑制の最新知見。",
    "isConference": true
  },
  {
    "id": "conf-int-soe-2027",
    "title": "SOE 2027 (European Society of Ophthalmology Congress)",
    "subtitle": "European Ophthalmology in the Global Perspective",
    "date": "2027-06-18",
    "endDate": "2027-06-20",
    "time": "現地時間",
    "region": "海外",
    "venue": "Megaron Athens International Conference Centre",
    "specialty": "一般眼科",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "European Society of Ophthalmology",
    "credits": "EACCME Credits",
    "conferenceRegion": "international",
    "conferenceCategory": "総合",
    "conferenceTier": "primary",
    "period": "2027年6月18日(金) 〜 6月20日(日)",
    "cityCountry": "アテネ / ギリシャ",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "https://soe2027.soevision.org/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "SOE",
      "欧州眼科学会",
      "国際学会"
    ],
    "description": "欧州全域の眼科医が結集するヨーロッパ眼科学コングレス。",
    "isConference": true
  },
  {
    "id": "oph-013",
    "venueId": "kobe-international-conference-center",
    "title": "第42回 JSCRS学術総会 (日本白内障屈折矯正手術学会)",
    "subtitle": "屈折矯正と水晶体再建術の次世代スタンダード",
    "date": "2027-06-25",
    "endDate": "2027-06-27",
    "time": "全日程",
    "region": "関西",
    "venue": "神戸国際会議場",
    "specialty": "白内障",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本白内障屈折矯正手術学会",
    "credits": "日本眼科学会生涯教育単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "白内障屈折",
    "conferenceTier": "subspecialty",
    "period": "2027年6月25日(金) 〜 6月27日(日)",
    "cityCountry": "神戸市（兵庫県） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "JSCRS",
      "白内障手術",
      "プレミアムIOL",
      "レーシック",
      "ICL"
    ],
    "description": "プレミアム眼内レンズ、有水晶体眼内レンズ(ICL)、難症例白内障手術。",
    "isConference": true
  },
  {
    "id": "conf-jp-myopia-2027",
    "title": "第8回 日本近視学会総会",
    "subtitle": "近視パンデミックに対峙するエビデンスと実践",
    "date": "2027-07-03",
    "endDate": "2027-07-04",
    "time": "全日程",
    "region": "関東",
    "venue": "高輪ゲートウェイコンベンションセンター",
    "specialty": "一般眼科",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本近視学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "眼光学CL近視",
    "conferenceTier": "subspecialty",
    "period": "2027年7月3日(土) 〜 7月4日(日)",
    "cityCountry": "東京都 / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "近視抑制",
      "オルソケラトロジー",
      "低濃度アトロピン",
      "レッドライト療法"
    ],
    "description": "小児近視進行予防、病的近視合併症対策、光環境と屈折発達。",
    "isConference": true
  },
  {
    "id": "conf-int-iois-2027",
    "venueId": "fukuoka-international-congress-center",
    "title": "IOIS 2027 (International Ocular Inflammation Society Congress)",
    "subtitle": "New Horizons in Uveitis and Ocular Immunology",
    "date": "2027-07-07",
    "endDate": "2027-07-10",
    "time": "全日程",
    "region": "九州・沖縄",
    "venue": "福岡国際会議場",
    "specialty": "一般眼科",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "International Ocular Inflammation Society",
    "credits": "国際単位認定",
    "conferenceRegion": "international",
    "conferenceCategory": "眼炎症感染",
    "conferenceTier": "subspecialty",
    "period": "2027年7月7日(水) 〜 7月10日(土)",
    "cityCountry": "福岡市（福岡県） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "日本開催 / 国内眼炎症・感染症関連学会併催",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "IOIS",
      "国際眼炎症学会",
      "ぶどう膜炎",
      "日本開催"
    ],
    "description": "ぶどう膜炎・眼免疫疾患の世界的研究者が日本に集う国際コングレス。",
    "isConference": true
  },
  {
    "id": "conf-jp-inflammation-2027",
    "title": "第60回 日本眼炎症学会",
    "subtitle": "眼炎症Week2027",
    "date": "2027-07-09",
    "endDate": "2027-07-11",
    "time": "全日程",
    "region": "九州・沖縄",
    "venue": "福岡国際会議場",
    "specialty": "一般眼科",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本眼感染症学会 / 日本眼炎症学会 / 日本眼科アレルギー学会 / 日本涙道・涙液学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "眼炎症感染",
    "conferenceTier": "subspecialty",
    "period": "2027年7月9日(金) 〜 7月11日(日)",
    "cityCountry": "福岡市（福岡県） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "2027 Congress of the International Ocular Inflammation Society (IOIS) 併催",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "ぶどう膜炎",
      "眼感染症",
      "アレルギー性結膜疾患",
      "涙道疾患",
      "IOIS併催"
    ],
    "description": "眼感染・眼炎症・アレルギー・涙道の4学会合同学術集会（国際眼炎症学会併催）。",
    "isConference": true
  },
  {
    "id": "conf-jp-circulation-2027",
    "title": "第43回 日本眼循環学会",
    "subtitle": "微小循環から解き明かす眼疾患病態",
    "date": "2027-07-17",
    "endDate": "2027-07-18",
    "time": "全日程",
    "region": "関東",
    "venue": "赤坂インターシティコンファレンス",
    "specialty": "網膜・硝子体",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本眼循環学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "網膜硝子体",
    "conferenceTier": "subspecialty",
    "period": "2027年7月17日(土) 〜 7月18日(日)",
    "cityCountry": "東京都 / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "眼血流",
      "OCTA",
      "網膜血管閉塞症",
      "緑内障血流"
    ],
    "description": "網膜・脈絡膜血流動態、OCTアンギオグラフィーによる微小血管定量評価。",
    "isConference": true
  },
  {
    "id": "conf-jp-cl-2027",
    "title": "第69回 日本コンタクトレンズ学会総会",
    "subtitle": "安心安全なコンタクトレンズ診療と新機能レンズの展望",
    "date": "2027-07-24",
    "endDate": "2027-07-25",
    "time": "全日程",
    "region": "関東",
    "venue": "東京建物 ぴあ シアター＆カンファレンス",
    "specialty": "一般眼科",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本コンタクトレンズ学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "眼光学CL近視",
    "conferenceTier": "subspecialty",
    "period": "2027年7月24日(土) 〜 7月25日(日)",
    "cityCountry": "東京都 / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "コンタクトレンズ",
      "CLトラブル",
      "角膜感染症",
      "スマートレンズ"
    ],
    "description": "CL関連眼障害の予防と適正使用、乱視・遠近両用・治療用CLの最新知見。",
    "isConference": true
  },
  {
    "id": "conf-jp-optics-2027",
    "title": "第63回 日本眼光学学会総会",
    "subtitle": "光学と視覚科学の交差点",
    "date": "2027-08-28",
    "endDate": "2027-08-29",
    "time": "全日程",
    "region": "関東",
    "venue": "御茶ノ水ソラシティカンファレンスセンター",
    "specialty": "一般眼科",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本眼光学学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "眼光学CL近視",
    "conferenceTier": "subspecialty",
    "period": "2027年8月28日(土) 〜 8月29日(日)",
    "cityCountry": "東京都 / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "眼光学",
      "波面収差",
      "眼内レンズ光学",
      "視機能測定"
    ],
    "description": "角膜・水晶体の光学特性、波面収差、視覚心理物理学の学際的探求。",
    "isConference": true
  },
  {
    "id": "conf-jp-cataract-2027",
    "title": "第66回 日本白内障学会総会・第53回 水晶体研究会",
    "subtitle": "水晶体の生物学から白内障治療の革新へ",
    "date": "2027-09-04",
    "endDate": "2027-09-05",
    "time": "全日程",
    "region": "関東",
    "venue": "北里大学白金キャンパス",
    "specialty": "白内障",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本白内障学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "白内障屈折",
    "conferenceTier": "subspecialty",
    "period": "2027年9月4日(土) 〜 9月5日(日)",
    "cityCountry": "東京都 / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "白内障",
      "水晶体混濁機構",
      "IOL混濁",
      "生化学"
    ],
    "description": "水晶体透明性維持機構、白内障発症メカニズム、手術合併症予防。",
    "isConference": true
  },
  {
    "id": "conf-jp-pharmacology-2027",
    "title": "第47回 日本眼薬理学会",
    "subtitle": "トランスレーショナル眼薬理学の挑戦",
    "date": "2027-09-11",
    "endDate": "2027-09-12",
    "time": "全日程",
    "region": "関東",
    "venue": "ホテル プラム（横浜市）",
    "specialty": "その他",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本眼薬理学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "その他",
    "conferenceTier": "subspecialty",
    "period": "2027年9月11日(土) 〜 9月12日(日)",
    "cityCountry": "横浜市（神奈川県） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "眼薬理",
      "分子標的薬",
      "緑内障点眼薬",
      "前臨床試験"
    ],
    "description": "新規受容体作動薬、バイオシミラー、網膜保護剤の研究。",
    "isConference": true
  },
  {
    "id": "conf-int-euretina-2027",
    "title": "EURETINA 2027 (27th EURETINA Congress)",
    "subtitle": "European Society of Retina Specialists",
    "date": "2027-09-16",
    "endDate": "2027-09-19",
    "time": "現地時間",
    "region": "海外",
    "venue": "未定",
    "specialty": "網膜・硝子体",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "EURETINA",
    "credits": "EACCME Credits",
    "conferenceRegion": "international",
    "conferenceCategory": "網膜硝子体",
    "conferenceTier": "primary",
    "period": "2027年9月16日(木) 〜 9月19日(日)",
    "cityCountry": "未定 / 欧州",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "https://euretina.org/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "EURETINA",
      "欧州網膜学会",
      "国際学会"
    ],
    "description": "欧州網膜硝子体学会年次学術大会。",
    "isConference": true
  },
  {
    "id": "conf-jp-oncology-2027",
    "title": "第14回 日本眼腫瘍学会",
    "subtitle": "眼部腫瘍の精密診断と集学的治療",
    "date": "2027-09-18",
    "endDate": "2027-09-19",
    "time": "全日程",
    "region": "中部",
    "venue": "富山国際会議場",
    "specialty": "眼形成",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本眼腫瘍学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "形成腫瘍",
    "conferenceTier": "subspecialty",
    "period": "2027年9月18日(土) 〜 9月19日(日)",
    "cityCountry": "富山市（富山県） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "眼腫瘍",
      "網膜芽細胞腫",
      "脈絡膜悪性黒色腫",
      "眼付属器リンパ腫"
    ],
    "description": "眼球内・眼付属器腫瘍の病理診断、重粒子線治療、機能温存外科。",
    "isConference": true
  },
  {
    "id": "conf-int-escrs-2027",
    "title": "ESCRS 2027 (45th Congress of the ESCRS)",
    "subtitle": "European Society of Cataract and Refractive Surgeons",
    "date": "2027-10-15",
    "endDate": "2027-10-19",
    "time": "現地時間",
    "region": "海外",
    "venue": "未定",
    "specialty": "白内障",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "ESCRS",
    "credits": "EACCME Credits",
    "conferenceRegion": "international",
    "conferenceCategory": "白内障屈折",
    "conferenceTier": "primary",
    "period": "2027年10月15日(金) 〜 10月19日(火)",
    "cityCountry": "未定 / 欧州",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "https://www.escrs.org/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "ESCRS",
      "欧州白内障屈折手術学会",
      "国際学会"
    ],
    "description": "欧州最大級の白内障屈折手術コングレス。",
    "isConference": true
  },
  {
    "id": "conf-jp-ringan-2027",
    "title": "第81回 日本臨床眼科学会 (臨眼 2027)",
    "subtitle": "臨床眼科学の次代を拓く英知の集結",
    "date": "2027-10-21",
    "endDate": "2027-10-24",
    "time": "全日程",
    "region": "関東",
    "venue": "東京国際フォーラム、JPタワー",
    "specialty": "一般眼科",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "公益財団法人 日本眼科学会 / 日本眼科医会",
    "credits": "日本眼科学会生涯教育単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "総合",
    "conferenceTier": "primary",
    "period": "2027年10月21日(木) 〜 10月24日(日)",
    "cityCountry": "千代田区（東京都） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "臨眼",
      "臨床眼科学会",
      "最大規模",
      "シンポジウム",
      "専門医単位"
    ],
    "description": "秋の国内最大規模臨床学術集会。全領域のシンポジウム・インストラクションコース。",
    "isConference": true
  },
  {
    "id": "conf-int-aao-2027",
    "title": "AAO 2027 Annual Meeting",
    "subtitle": "American Academy of Ophthalmology",
    "date": "2027-11-13",
    "endDate": "2027-11-15",
    "time": "現地時間",
    "region": "海外",
    "venue": "Las Vegas Convention Center, Las Vegas, NV",
    "specialty": "一般眼科",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "American Academy of Ophthalmology",
    "credits": "AMA PRA Category 1 Credits",
    "conferenceRegion": "international",
    "conferenceCategory": "総合",
    "conferenceTier": "primary",
    "period": "2027年11月13日(土) 〜 11月15日(月)",
    "cityCountry": "ラスベガス（ネバダ州） / 米国",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "https://www.aao.org/annual-meeting",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "AAO",
      "米国眼科学会",
      "ラスベガス"
    ],
    "description": "米国眼科学会年次学術総会。",
    "isConference": true
  },
  {
    "id": "conf-jp-neuro-2027",
    "title": "第65回 日本神経眼科学会総会",
    "subtitle": "Asian Neuro-ophthalmology Society (ASNOS 2027) 併催",
    "date": "2027-11-18",
    "endDate": "2027-11-20",
    "time": "全日程",
    "region": "関西",
    "venue": "神戸国際会議場",
    "specialty": "神経眼科",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本神経眼科学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "神経眼科",
    "conferenceTier": "subspecialty",
    "period": "2027年11月18日(木) 〜 11月20日(土)",
    "cityCountry": "神戸市（兵庫県） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "Asian Neuro-ophthalmology Society (ASNOS) 併催",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "神経眼科",
      "ASNOS併催",
      "視神経疾患",
      "眼球運動"
    ],
    "description": "アジア神経眼科学会と合同開催される国際色豊かな総会。",
    "isConference": true
  },
  {
    "id": "conf-int-asnos-2027",
    "title": "ASNOS 2027 (Asian Neuro-ophthalmology Society Congress)",
    "subtitle": "Bridging East and West in Neuro-ophthalmology",
    "date": "2027-11-18",
    "endDate": "2027-11-20",
    "time": "全日程",
    "region": "関西",
    "venue": "神戸国際会議場",
    "specialty": "神経眼科",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "Asian Neuro-ophthalmology Society / 日本神経眼科学会",
    "credits": "国際単位認定",
    "conferenceRegion": "international",
    "conferenceCategory": "神経眼科",
    "conferenceTier": "subspecialty",
    "period": "2027年11月18日(木) 〜 11月20日(土)",
    "cityCountry": "神戸市（兵庫県） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "日本神経眼科学会総会併催 / 神戸開催",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "ASNOS",
      "アジア神経眼科学会",
      "神戸開催"
    ],
    "description": "アジア地域の神経眼科エキスパートが集う国際学会。",
    "isConference": true
  },
  {
    "id": "conf-jp-ai-2027",
    "title": "第3回 日本眼科AI学会総会",
    "subtitle": "AIが拓く眼科医療のブレイクスルーと実装",
    "date": "2027-11-26",
    "endDate": "2027-11-26",
    "time": "全日程",
    "region": "関東",
    "venue": "TKPガーデンシティ渋谷",
    "specialty": "その他",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本眼科AI学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "AI",
    "conferenceTier": "subspecialty",
    "period": "2027年11月26日(金)",
    "cityCountry": "東京都 / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "AI",
      "ディープラーニング",
      "眼底画像AI",
      "自動スクリーニング"
    ],
    "description": "眼科画像AI診断、大規模言語モデル活用、医療機器プログラム実用化。",
    "isConference": true
  },
  {
    "id": "conf-jp-jrvs-2027",
    "title": "第66回 日本網膜硝子体学会総会",
    "subtitle": "網膜疾患制圧へのフロンティア",
    "date": "2027-12-10",
    "endDate": "2027-12-12",
    "time": "全日程",
    "region": "関西",
    "venue": "大阪国際会議場（グランキューブ大阪）",
    "specialty": "網膜・硝子体",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本網膜硝子体学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "網膜硝子体",
    "conferenceTier": "subspecialty",
    "period": "2027年12月10日(金) 〜 12月12日(日)",
    "cityCountry": "大阪市（大阪府） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "網膜硝子体",
      "硝子体手術",
      "遺伝子治療",
      "OCTA"
    ],
    "description": "極小切開硝子体手術、黄斑下手術、再生医療・遺伝子治療の最新知見。",
    "isConference": true
  },
  {
    "id": "conf-jp-presbyopia-2028",
    "title": "第5回 日本老視学会学術総会",
    "subtitle": "老視研究と最新治療テクノロジー",
    "date": "2028-01-15",
    "endDate": "2028-01-16",
    "time": "全日程",
    "region": "関西",
    "venue": "京都テルサ（京都府民総合交流プラザ）",
    "specialty": "白内障",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本老視学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "白内障屈折",
    "conferenceTier": "subspecialty",
    "period": "2028年1月15日(土) 〜 1月16日(日)",
    "cityCountry": "京都市（京都府） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "老視",
      "調節機能",
      "老眼治療"
    ],
    "description": "老眼の基礎研究、多焦点レンズ、点眼薬の最新エビデンス。",
    "isConference": true
  },
  {
    "id": "conf-jp-surgery-2028",
    "title": "第51回 日本眼科手術学会学術総会",
    "subtitle": "匠の技を未来へつなぐ",
    "date": "2028-01-28",
    "endDate": "2028-01-30",
    "time": "全日程",
    "region": "関東",
    "venue": "未定",
    "specialty": "その他",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本眼科手術学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "その他",
    "conferenceTier": "subspecialty",
    "period": "2028年1月28日(金) 〜 1月30日(日)",
    "cityCountry": "未定 / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "眼科手術",
      "低侵襲手術",
      "合併症対策"
    ],
    "description": "眼科手術手技の向上と安全性を追究する全国学会。",
    "isConference": true
  },
  {
    "id": "conf-jp-cornea-2028",
    "title": "角膜カンファランス2028",
    "subtitle": "角膜疾患の克服へ向けた革新",
    "date": "2028-02-10",
    "endDate": "2028-02-12",
    "time": "全日程",
    "region": "中国",
    "venue": "米子コンベンションセンター（ビッグシップ）",
    "specialty": "角膜・外眼部",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本角膜学会 / 日本角膜移植学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "角膜",
    "conferenceTier": "subspecialty",
    "period": "2028年2月10日(木) 〜 2月12日(土)",
    "cityCountry": "米子市（鳥取県） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "第52回日本角膜学会総会・第44回日本角膜移植学会",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "角膜カンファランス",
      "角膜移植",
      "眼表面"
    ],
    "description": "角膜・外眼部・内皮移植の最新知見。",
    "isConference": true
  },
  {
    "id": "conf-jp-eyelid-2028",
    "title": "第39回 日本眼瞼義眼床手術学会学術集会",
    "subtitle": "眼瞼・義眼床手術の基礎と臨床の最前線",
    "date": "2028-02-12",
    "endDate": "2028-02-13",
    "time": "全日程",
    "region": "未定",
    "venue": "未定",
    "specialty": "眼形成",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本眼瞼義眼床手術学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "形成腫瘍",
    "conferenceTier": "subspecialty",
    "period": "2028年2月（予定）",
    "cityCountry": "未定 / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": ""
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "眼瞼手術",
      "義眼床再建",
      "機能美"
    ],
    "description": "眼瞼および義眼床手術の機能的・整容的治療手技に関する年次学術集会。",
    "isConference": true
  },
  {
    "id": "conf-jp-iscev-2028",
    "title": "第76回 日本臨床視覚電気生理学会（韓日合同）",
    "subtitle": "日韓の英知を結ぶ電気生理学フロンティア",
    "date": "2028-02-18",
    "endDate": "2028-02-19",
    "time": "全日程",
    "region": "関西",
    "venue": "千里ライフサイエンスセンター",
    "specialty": "その他",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本臨床視覚電気生理学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "その他",
    "conferenceTier": "subspecialty",
    "period": "2028年2月18日(金) 〜 2月19日(土)",
    "cityCountry": "豊中市（大阪府） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "韓日合同開催",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "ERG",
      "韓日合同",
      "視覚電気生理"
    ],
    "description": "臨床視覚電気生理学の韓日合同学術集会。",
    "isConference": true
  },
  {
    "id": "conf-jp-diabetic-2028",
    "title": "第34回 日本糖尿病眼学会総会",
    "subtitle": "北の大地で語る糖尿病眼合併症の未来",
    "date": "2028-03-03",
    "endDate": "2028-03-04",
    "time": "全日程",
    "region": "北海道",
    "venue": "札幌コンベンションセンター",
    "specialty": "網膜・硝子体",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本糖尿病眼学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "網膜硝子体",
    "conferenceTier": "subspecialty",
    "period": "2028年3月3日(金) 〜 3月4日(土)",
    "cityCountry": "札幌市（北海道） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "糖尿病網膜症",
      "DME",
      "抗VEGF",
      "札幌開催"
    ],
    "description": "糖尿病黄斑浮腫・網膜症の最新治療とチーム医療。",
    "isConference": true
  },
  {
    "id": "conf-int-ips-2028",
    "title": "IPS 2028 (26th International Perimetric Society Congress)",
    "subtitle": "Perimetry and Imaging in the Global Era",
    "date": "2028-03-08",
    "endDate": "2028-03-11",
    "time": "全日程",
    "region": "関東",
    "venue": "東京慈恵会医科大学 講堂",
    "specialty": "その他",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "International Perimetric Society / 日本視野画像学会",
    "credits": "国際単位認定",
    "conferenceRegion": "international",
    "conferenceCategory": "その他",
    "conferenceTier": "subspecialty",
    "period": "2028年3月8日(水) 〜 3月11日(土)",
    "cityCountry": "東京都 / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "日本開催 / 日本視野画像学会併催",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "IPS",
      "国際視野学会",
      "日本開催",
      "視野解析"
    ],
    "description": "国際視野学会の東京コングレス。構造機能解析の世界的研究が集結。",
    "isConference": true
  },
  {
    "id": "conf-jp-perimetry-2028",
    "title": "第40回 日本視野画像学会学術集会",
    "subtitle": "IPS 2028 (International Perimetric Society) 併催",
    "date": "2028-03-11",
    "endDate": "2028-03-12",
    "time": "全日程",
    "region": "関東",
    "venue": "東京慈恵会医科大学",
    "specialty": "その他",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本視野画像学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "その他",
    "conferenceTier": "subspecialty",
    "period": "2028年3月11日(土) 〜 3月12日(日)",
    "cityCountry": "東京都 / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "国際視野学会 (IPS 2028) 併催",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "視野画像学会",
      "IPS併催",
      "緑内障解析"
    ],
    "description": "国際視野学会(IPS)と併催される視野解析の国際学術集会。",
    "isConference": true
  },
  {
    "id": "conf-int-apao-2028",
    "title": "APAO 2028 (43rd Asia-Pacific Academy of Ophthalmology Congress)",
    "subtitle": "Empowering Eye Care in the Asia-Pacific Region",
    "date": "2028-03-16",
    "endDate": "2028-03-19",
    "time": "現地時間",
    "region": "海外",
    "venue": "SMX Convention Center Manila",
    "specialty": "一般眼科",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "APAO",
    "credits": "国際単位認定",
    "conferenceRegion": "international",
    "conferenceCategory": "総合",
    "conferenceTier": "primary",
    "period": "2028年3月16日(木) 〜 3月19日(日)",
    "cityCountry": "マニラ / フィリピン",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "https://apaophth.org/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "APAO",
      "アジア太平洋学会",
      "マニラ開催"
    ],
    "description": "アジア太平洋眼科学会年次コングレス。",
    "isConference": true
  },
  {
    "id": "conf-int-fujiretina-2028",
    "title": "FujiRetina 2028",
    "subtitle": "International Symposium on Retinal Diseases",
    "date": "2028-03-24",
    "endDate": "2028-03-26",
    "time": "全日程",
    "region": "関東",
    "venue": "東京国際フォーラム",
    "specialty": "網膜・硝子体",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "FujiRetina Organizing Committee",
    "credits": "国際単位認定",
    "conferenceRegion": "international",
    "conferenceCategory": "網膜硝子体",
    "conferenceTier": "subspecialty",
    "period": "2028年3月24日(金) 〜 3月26日(日)",
    "cityCountry": "東京都 / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "日本開催",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "FujiRetina",
      "網膜疾患",
      "東京開催"
    ],
    "description": "東京で開催されるプレミアム国際網膜カンファレンス。",
    "isConference": true
  },
  {
    "id": "conf-jp-jos-2028",
    "title": "第132回 日本眼科学会総会",
    "subtitle": "眼科学の新たな世紀を拓く",
    "date": "2028-04-13",
    "endDate": "2028-04-16",
    "time": "全日程",
    "region": "関西",
    "venue": "大阪府立国際会議場（グランキューブ大阪）、リーガロイヤルホテル大阪",
    "specialty": "一般眼科",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "公益財団法人 日本眼科学会",
    "credits": "日本眼科学会生涯教育単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "総合",
    "conferenceTier": "primary",
    "period": "2028年4月13日(木) 〜 4月16日(日)",
    "cityCountry": "大阪市（大阪府） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "日本眼科学会総会",
      "基幹学会",
      "大阪開催",
      "専門医単位"
    ],
    "description": "春の日本眼科学会年次総会。基礎・臨床の全領域を網羅する国内最高峰の学会。",
    "isConference": true
  },
  {
    "id": "conf-int-ascrs-2028",
    "title": "ASCRS 2028 Annual Meeting",
    "subtitle": "American Society of Cataract and Refractive Surgery",
    "date": "2028-04-21",
    "endDate": "2028-04-24",
    "time": "現地時間",
    "region": "海外",
    "venue": "Boston Convention and Exhibition Center, Boston, MA",
    "specialty": "白内障",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "ASCRS",
    "credits": "CME Credits",
    "conferenceRegion": "international",
    "conferenceCategory": "白内障屈折",
    "conferenceTier": "primary",
    "period": "2028年4月21日(金) 〜 4月24日(月)",
    "cityCountry": "ボストン（マサチューセッツ州） / 米国",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "https://ascrs.org/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "ASCRS",
      "米国白内障屈折学会",
      "ボストン開催"
    ],
    "description": "米国白内障屈折矯正手術学会年次学術総会。",
    "isConference": true
  },
  {
    "id": "conf-int-arvo-2028",
    "title": "ARVO 2028 Annual Meeting",
    "subtitle": "Association for Research in Vision and Ophthalmology",
    "date": "2028-04-30",
    "endDate": "2028-05-04",
    "time": "現地時間",
    "region": "海外",
    "venue": "Metro Toronto Convention Centre, Toronto, ON",
    "specialty": "一般眼科",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "ARVO",
    "credits": "CME Credits",
    "conferenceRegion": "international",
    "conferenceCategory": "総合",
    "conferenceTier": "primary",
    "period": "2028年4月30日(日) 〜 5月4日(木)",
    "cityCountry": "トロント（オンタリオ州） / カナダ",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "https://www.arvo.org/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "ARVO",
      "視覚研究",
      "トロント開催"
    ],
    "description": "世界最大の視覚科学・眼科学研究総会。",
    "isConference": true
  },
  {
    "id": "conf-jp-myopia-2028",
    "title": "第9回 日本近視学会総会",
    "subtitle": "近視制御のグローバルスタンダード",
    "date": "2028-05-20",
    "endDate": "2028-05-21",
    "time": "全日程",
    "region": "関西",
    "venue": "コングレコンベンションセンター（グランフロント大阪）",
    "specialty": "一般眼科",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本近視学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "眼光学CL近視",
    "conferenceTier": "subspecialty",
    "period": "2028年5月20日(土) 〜 5月21日(日)",
    "cityCountry": "大阪市（大阪府） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "近視",
      "学童近視",
      "オルソケラトロジー",
      "大阪開催"
    ],
    "description": "近視発症・進行抑制の最新介入研究と実臨床。",
    "isConference": true
  },
  {
    "id": "conf-jp-lowvision-2028",
    "title": "第29回 日本ロービジョン学会学術総会",
    "subtitle": "東北から発信する包括的ビジョンサポート",
    "date": "2028-05-26",
    "endDate": "2028-05-28",
    "time": "全日程",
    "region": "東北",
    "venue": "山形テルサ",
    "specialty": "その他",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本ロービジョン学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "ロービジョン",
    "conferenceTier": "subspecialty",
    "period": "2028年5月26日(金) 〜 5月28日(日)",
    "cityCountry": "山形市（山形県） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "ロービジョンケア",
      "福祉連携",
      "視覚補助具",
      "山形開催"
    ],
    "description": "ロービジョン者のQOL向上と地域支援ネットワーク。",
    "isConference": true
  },
  {
    "id": "conf-jp-pediatric-2028",
    "title": "第84回 日本弱視斜視学会総会・第53回 日本小児眼科学会総会",
    "subtitle": "視機能発達の科学と小児眼科診療の深化",
    "date": "2028-06-02",
    "endDate": "2028-06-03",
    "time": "全日程",
    "region": "中部",
    "venue": "朱鷺メッセ（新潟コンベンションセンター）",
    "specialty": "小児・斜視弱視",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本弱視斜視学会 / 日本小児眼科学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "小児斜視",
    "conferenceTier": "subspecialty",
    "period": "2028年6月2日(金) 〜 6月3日(土)",
    "cityCountry": "新潟市（新潟県） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "弱視斜視",
      "小児眼科",
      "斜視手術",
      "新潟開催"
    ],
    "description": "斜視弱視の早期発見プロトコルと手術手技。",
    "isConference": true
  },
  {
    "id": "conf-jp-jsoprs-2028",
    "title": "第15回 日本眼形成再建外科学会学術集会 (JSOPRS 2028)",
    "subtitle": "眼形成再建の技術と解剖の調和",
    "date": "2028-06-10",
    "endDate": "2028-06-11",
    "time": "全日程",
    "region": "中国",
    "venue": "未定",
    "specialty": "眼形成",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本眼形成再建外科学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "形成腫瘍",
    "conferenceTier": "subspecialty",
    "period": "2028年6月10日(土) 〜 6月11日(日)",
    "cityCountry": "広島市（広島県） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "http://www.jsoprs.jp/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": "http://www.jsoprs.jp/"
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "眼形成",
      "眼瞼下垂",
      "広島開催"
    ],
    "description": "眼瞼再建、涙道手術、眼窩手術手技の最新知見。",
    "isConference": true
  },
  {
    "id": "conf-jp-optics-2028",
    "title": "第64回 日本眼光学学会総会",
    "subtitle": "光と視覚の未来テクノロジー",
    "date": "2028-06-16",
    "endDate": "2028-06-18",
    "time": "全日程",
    "region": "九州・沖縄",
    "venue": "未定",
    "specialty": "一般眼科",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本眼光学学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "眼光学CL近視",
    "conferenceTier": "subspecialty",
    "period": "2028年6月16日(金) 〜 6月18日(日)",
    "cityCountry": "沖縄県 / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "眼光学",
      "波面解析",
      "沖縄開催"
    ],
    "description": "眼光学機器開発、収差解析、視覚心理物理学。",
    "isConference": true
  },
  {
    "id": "conf-jp-jscrs-2028",
    "venueId": "pacifico-yokohama",
    "title": "第43回 JSCRS学術総会 (日本白内障屈折矯正手術学会)",
    "subtitle": "白内障屈折手術の新たな到達点",
    "date": "2028-06-30",
    "endDate": "2028-07-02",
    "time": "全日程",
    "region": "関東",
    "venue": "パシフィコ横浜",
    "specialty": "白内障",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本白内障屈折矯正手術学会",
    "credits": "日本眼科学会生涯教育単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "白内障屈折",
    "conferenceTier": "subspecialty",
    "period": "2028年6月30日(金) 〜 7月2日(日)",
    "cityCountry": "横浜市（神奈川県） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "JSCRS",
      "白内障手術",
      "プレミアムIOL",
      "横浜開催"
    ],
    "description": "最新眼内レンズ、低侵襲白内障手術手技、屈折矯正手術。",
    "isConference": true
  },
  {
    "id": "conf-jp-inflammation-2028",
    "title": "第65回 日本眼感染症学会・第61回 日本眼炎症学会・第60回 日本眼科アレルギー学会・第47回 日本涙道・涙液学会総会",
    "subtitle": "眼表面・眼内炎症制御のフロンティア",
    "date": "2028-07-07",
    "endDate": "2028-07-09",
    "time": "全日程",
    "region": "四国",
    "venue": "高知市文化プラザかるぽーと",
    "specialty": "一般眼科",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本眼感染症学会 / 日本眼炎症学会 / 日本眼科アレルギー学会 / 日本涙道・涙液学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "眼炎症感染",
    "conferenceTier": "subspecialty",
    "period": "2028年7月7日(金) 〜 7月9日(日)",
    "cityCountry": "高知市（高知県） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "眼感染症",
      "眼炎症",
      "アレルギー",
      "涙道",
      "高知開催"
    ],
    "description": "4学会合同による感染・炎症・涙道疾患の学術集会。",
    "isConference": true
  },
  {
    "id": "conf-jp-cl-2028",
    "title": "第70回 日本コンタクトレンズ学会総会",
    "subtitle": "70年の歩みと未来のコンタクトレンズ医療",
    "date": "2028-07-14",
    "endDate": "2028-07-16",
    "time": "全日程",
    "region": "関西",
    "venue": "神戸国際会議場",
    "specialty": "一般眼科",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本コンタクトレンズ学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "眼光学CL近視",
    "conferenceTier": "subspecialty",
    "period": "2028年7月14日(金) 〜 7月16日(日)",
    "cityCountry": "神戸市（兵庫県） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "コンタクトレンズ",
      "CL安全装用",
      "神戸開催"
    ],
    "description": "第70回記念学術総会。CL適正装用と高度機能性レンズ。",
    "isConference": true
  },
  {
    "id": "conf-jp-cataract-2028",
    "title": "第67回 日本白内障学会総会・第54回 水晶体研究会",
    "subtitle": "水晶体加齢変化と白内障病態解明",
    "date": "2028-09-02",
    "endDate": "2028-09-03",
    "time": "全日程",
    "region": "関東",
    "venue": "未定",
    "specialty": "白内障",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本白内障学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "白内障屈折",
    "conferenceTier": "subspecialty",
    "period": "2028年9月2日(土) 〜 9月3日(日)",
    "cityCountry": "東京都 / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "白内障",
      "水晶体研究会"
    ],
    "description": "水晶体タンパク変性、白内障創薬、術後炎症制御。",
    "isConference": true
  },
  {
    "id": "conf-jp-oncology-2028",
    "title": "第15回 日本眼腫瘍学会",
    "subtitle": "眼部悪性腫瘍の最新治療と視機能温存",
    "date": "2028-09-09",
    "endDate": "2028-09-10",
    "time": "全日程",
    "region": "関西",
    "venue": "未定",
    "specialty": "眼形成",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本眼腫瘍学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "形成腫瘍",
    "conferenceTier": "subspecialty",
    "period": "2028年9月9日(土) 〜 9月10日(日)",
    "cityCountry": "京都府 / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "眼腫瘍",
      "京都開催",
      "集学的治療"
    ],
    "description": "網膜芽細胞腫、脈絡膜悪性腫瘍、眼窩悪性リンパ腫。",
    "isConference": true
  },
  {
    "id": "conf-jp-ringan-2028",
    "title": "第82回 日本臨床眼科学会 (臨眼 2028)",
    "subtitle": "臨床眼科の叡智とイノベーション",
    "date": "2028-10-06",
    "endDate": "2028-10-09",
    "time": "全日程",
    "region": "関東",
    "venue": "東京国際フォーラム",
    "specialty": "一般眼科",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "公益財団法人 日本眼科学会 / 日本眼科医会",
    "credits": "日本眼科学会生涯教育単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "総合",
    "conferenceTier": "primary",
    "period": "2028年10月6日(金) 〜 10月9日(月・祝)",
    "cityCountry": "東京都 / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "臨眼",
      "日本臨床眼科学会",
      "東京開催",
      "専門医単位"
    ],
    "description": "国内最大規模の臨床学術集会。全サブスペシャリティの実臨床知見。",
    "isConference": true
  },
  {
    "id": "conf-int-escrs-2028",
    "title": "ESCRS 2028 (46th Congress of the ESCRS)",
    "subtitle": "European Society of Cataract and Refractive Surgeons",
    "date": "2028-10-06",
    "endDate": "2028-10-10",
    "time": "現地時間",
    "region": "海外",
    "venue": "未定",
    "specialty": "白内障",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "ESCRS",
    "credits": "EACCME Credits",
    "conferenceRegion": "international",
    "conferenceCategory": "白内障屈折",
    "conferenceTier": "primary",
    "period": "2028年10月6日(金) 〜 10月10日(火)",
    "cityCountry": "未定 / 欧州",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "https://www.escrs.org/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "ESCRS",
      "欧州白内障屈折学会"
    ],
    "description": "欧州白内障屈折手術学会年次大会。",
    "isConference": true
  },
  {
    "id": "conf-int-aao-2028",
    "title": "AAO 2028 Annual Meeting",
    "subtitle": "American Academy of Ophthalmology",
    "date": "2028-10-14",
    "endDate": "2028-10-16",
    "time": "現地時間",
    "region": "海外",
    "venue": "McCormick Place, Chicago, IL",
    "specialty": "一般眼科",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "American Academy of Ophthalmology",
    "credits": "AMA PRA Category 1 Credits",
    "conferenceRegion": "international",
    "conferenceCategory": "総合",
    "conferenceTier": "primary",
    "period": "2028年10月14日(土) 〜 10月16日(月)",
    "cityCountry": "シカゴ（イリノイ州） / 米国",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "https://www.aao.org/annual-meeting",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "AAO",
      "米国眼科学会",
      "シカゴ開催"
    ],
    "description": "米国眼科学会年次学術総会。",
    "isConference": true
  },
  {
    "id": "conf-int-apvrs-2028",
    "title": "APVRS 2028 (18th Asia-Pacific Vitreo-retina Society Congress)",
    "subtitle": "Asia-Pacific Vitreo-retina Society",
    "date": "2028-11-17",
    "endDate": "2028-11-20",
    "time": "現地時間",
    "region": "海外",
    "venue": "Bangkok Convention Centre, Bangkok",
    "specialty": "網膜・硝子体",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "Asia-Pacific Vitreo-retina Society",
    "credits": "国際単位認定",
    "conferenceRegion": "international",
    "conferenceCategory": "網膜硝子体",
    "conferenceTier": "primary",
    "period": "2028年11月17日(金) 〜 11月20日(月)",
    "cityCountry": "バンコク / タイ",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "https://www.apvrs.org/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "WOC 2028 と同日程開催",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "APVRS",
      "アジア太平洋網膜学会",
      "バンコク開催"
    ],
    "description": "アジア太平洋地域の網膜硝子体専門医コングレス。",
    "isConference": true
  },
  {
    "id": "conf-int-woc-2028",
    "title": "WOC 2028 (World Ophthalmology Congress)",
    "subtitle": "International Council of Ophthalmology (ICO)",
    "date": "2028-11-17",
    "endDate": "2028-11-20",
    "time": "現地時間",
    "region": "海外",
    "venue": "Kuala Lumpur Convention Centre (KLCC)",
    "specialty": "一般眼科",
    "eventType": "海外学会",
    "format": "現地",
    "sponsor": "International Council of Ophthalmology",
    "credits": "CME Credits / 国際眼科学会認定",
    "conferenceRegion": "international",
    "conferenceCategory": "総合",
    "conferenceTier": "primary",
    "period": "2028年11月17日(金) 〜 11月20日(月)",
    "cityCountry": "クアラルンプール / マレーシア",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "https://icoph.org/woc/",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji_international.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "WOC",
      "世界眼科学会議",
      "ICO",
      "マレーシア開催"
    ],
    "description": "国際眼科学会(ICO)主催の世界眼科学コングレス。",
    "isConference": true
  },
  {
    "id": "conf-jp-pharmacology-2028",
    "title": "第48回 日本眼薬理学会",
    "subtitle": "次世代眼科創薬プラットフォーム",
    "date": "2028-11-18",
    "endDate": "2028-11-19",
    "time": "全日程",
    "region": "関西",
    "venue": "神戸国際会議場",
    "specialty": "その他",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本眼薬理学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "その他",
    "conferenceTier": "subspecialty",
    "period": "2028年11月18日(土) 〜 11月19日(日)",
    "cityCountry": "神戸市（兵庫県） / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "眼薬理",
      "創薬",
      "DDS",
      "神戸開催"
    ],
    "description": "点眼剤・徐放デバイス・新規作用機序薬の研究。",
    "isConference": true
  },
  {
    "id": "conf-jp-neuro-2028",
    "title": "第66回 日本神経眼科学会総会",
    "subtitle": "中枢と眼をつなぐ神経眼科の最前線",
    "date": "2028-11-24",
    "endDate": "2028-11-25",
    "time": "全日程",
    "region": "関東",
    "venue": "未定",
    "specialty": "神経眼科",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本神経眼科学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "神経眼科",
    "conferenceTier": "subspecialty",
    "period": "2028年11月24日(金) 〜 11月25日(土)",
    "cityCountry": "未定 / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "神経眼科",
      "視神経症",
      "眼筋麻痺"
    ],
    "description": "視神経疾患、脳神経麻痺、頭蓋内病変による視覚障害。",
    "isConference": true
  },
  {
    "id": "conf-jp-jrvs-2028",
    "title": "第67回 日本網膜硝子体学会総会・第44回 日本眼循環学会",
    "subtitle": "網膜硝子体と微小循環の融合シンポジウム",
    "date": "2028-12-01",
    "endDate": "2028-12-03",
    "time": "全日程",
    "region": "関東",
    "venue": "東京国際フォーラム",
    "specialty": "網膜・硝子体",
    "eventType": "国内学会",
    "format": "現地",
    "sponsor": "日本網膜硝子体学会 / 日本眼循環学会",
    "credits": "日本眼科学会認定単位",
    "conferenceRegion": "domestic",
    "conferenceCategory": "網膜硝子体",
    "conferenceTier": "subspecialty",
    "period": "2028年12月1日(金) 〜 12月3日(日)",
    "cityCountry": "東京都 / 日本",
    "abstractDeadline": "未定",
    "earlyBirdDeadline": "未定",
    "officialUrl": "",
    "sourceUrl": "https://www.nichigan.or.jp/member/syukai/hyoji.html",
    "note": "日本網膜硝子体学会・日本眼循環学会 合同開催",
    "abstractSubmission": {
      "status": "unknown",
      "startDate": null,
      "deadline": null,
      "url": null
    },
    "calendarStatus": {
      "google": {
        "status": "free",
        "conflicts": []
      },
      "icloud": {
        "status": "free",
        "conflicts": []
      },
      "isAdded": false
    },
    "tags": [
      "網膜硝子体",
      "眼循環",
      "合同総会",
      "東京開催"
    ],
    "description": "網膜硝子体学会と眼循環学会の合同年次学術集会。",
    "isConference": true
  }
];
