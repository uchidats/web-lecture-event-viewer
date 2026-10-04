/**
 * 眼科医向け 講演会・学会イベント サンプルデータ
 * 
 * calendarStatus:
 *  - google: { status: "free" | "partial" | "busy", conflicts: [{ start, end, title }] }
 *  - icloud: { status: "free" | "partial" | "busy", conflicts: [{ start, end, title }] }
 *  - isAdded: boolean (カレンダー登録済みフラグ)
 * 
 * 学会 (国内学会・海外学会) 特有フィールド:
 *  - isConference: true
 *  - period: 会期（例: "2026年10月22日(木)〜10月25日(日)"）
 *  - cityCountry: 開催都市・国（例: "京都市（京都府） / 日本"）
 *  - abstractDeadline: 演題登録締切（例: "2026年6月15日(月) 17:00"）
 *  - earlyBirdDeadline: 早期登録締切（例: "2026年8月31日(月)"）
 *  - officialUrl: 公式サイト / 申込ページURL
 * 
 * 学会関連セミナー（ランチョン・モーニング・イブニング・共催等）特有フィールド:
 *  - parentConferenceId: 親学会のイベントID（例: "oph-001"）。親学会が参加予定の場合のみ一覧に表示。
 */
const sampleEvents = [
  {
    id: "oph-001",
    title: "第79回 日本臨床眼科学会 (臨眼 2026)",
    subtitle: "眼科イノベーションの胎動：最前線の知見と実臨床への架け橋",
    date: "2026-10-22",
    endDate: "2026-10-25",
    time: "09:00 - 18:00 (全日程)",
    region: "関西",
    venue: "国立京都国際会館（京都府京都市）",
    specialty: "網膜・硝子体",
    eventType: "国内学会",
    format: "ハイブリッド",
    sponsor: "公益財団法人 日本眼科学会 / 日本眼科医会",
    credits: "日本眼科学会生涯教育 8単位 / 専門医制度認定",
    calendarStatus: {
      google: {
        status: "partial",
        conflicts: [
          { start: "13:00", end: "17:00", title: "外来手術枠" }
        ]
      },
      icloud: {
        status: "free",
        conflicts: []
      },
      isAdded: false
    },
    officialUrl: "https://example.com/ringan2026",
    pdfUrl: "program_ringan2026.pdf",
    tags: ["専門医単位", "国内最大規模", "シンポジウム", "機器展示"],
    description: "国内最大規模の眼科学術集会。網膜硝子体、緑内障、角膜、白内障屈折手術、眼形成まで全サブスペシャリティの最新知見が集結。",
    isConference: true,
    period: "2026年10月22日(木) 〜 10月25日(日)",
    cityCountry: "京都市（京都府） / 日本",
    abstractDeadline: "2026年5月20日(水) 締切済",
    earlyBirdDeadline: "2026年8月31日(月) 締切済"
  },
  {
    id: "oph-002",
    title: "緑内障薬物治療Update 〜配合点眼薬とSLTのポジショニング〜",
    subtitle: "目標眼圧達成率の向上とアドヒアランス改善を目指す最新エビデンス",
    date: "2026-10-15",
    endDate: "2026-10-15",
    time: "19:00 - 20:30",
    region: "全国Web",
    venue: "Zoomウェビナー（オンラインライブ配信）",
    specialty: "緑内障",
    eventType: "講演会・勉強会",
    format: "Web",
    sponsor: "日本緑内障先端治療研究会 / 眼科メディカルファーマ",
    credits: "日本眼科学会生涯教育 1単位",
    calendarStatus: {
      google: {
        status: "free",
        conflicts: []
      },
      icloud: {
        status: "free",
        conflicts: []
      },
      isAdded: false
    },
    officialUrl: "https://example.com/glaucoma-webinar-oct",
    pdfUrl: "glaucoma_update_2026.pdf",
    tags: ["点眼指導", "SLT", "Webセミナー", "専門医単位"],
    description: "早期〜中期緑内障における第一選択薬の使い分けと、防腐剤フリー点眼薬の角膜上皮への影響、SLT導入のベストタイミングを検証。",
    isConference: false
  },
  {
    id: "oph-003",
    title: "第35回 日本小児眼科学会・日本弱視斜視学会 合同学会",
    subtitle: "視覚発達の臨界期を見据えた早期診断と最新の視能矯正アプローチ",
    date: "2026-10-30",
    endDate: "2026-11-02",
    time: "09:00 - 17:30 (全日程)",
    region: "関東",
    venue: "パシフィコ横浜 会議センター（神奈川県横浜市）",
    specialty: "小児・斜視弱視",
    eventType: "国内学会",
    format: "ハイブリッド",
    sponsor: "日本小児眼科学会 / 日本弱視斜視学会",
    credits: "日本眼科学会生涯教育 6単位",
    calendarStatus: {
      google: {
        status: "busy",
        conflicts: [
          { start: "14:00", end: "17:00", title: "休日当番医" }
        ]
      },
      icloud: {
        status: "partial",
        conflicts: [
          { start: "16:00", end: "18:00", title: "家族送迎" }
        ]
      },
      isAdded: false
    },
    officialUrl: "https://example.com/jasp-jsas-2026",
    pdfUrl: "jasp_jsas_2026.pdf",
    tags: ["合同学会", "弱視斜視", "視能矯正", "月またぎ会期"],
    description: "2学会合同で開催される年次学術集会。乳幼児の屈折異常スクリーニング、間欠性外斜視の手術時期、発達障害児の視機能評価を網羅。",
    isConference: true,
    period: "2026年10月30日(金) 〜 11月2日(月)",
    cityCountry: "横浜市（神奈川県） / 日本",
    abstractDeadline: "2026年6月30日(火) 締切済",
    earlyBirdDeadline: "2026年9月15日(火) 締切済"
  },
  {
    id: "oph-004",
    title: "AAO 2026 Annual Meeting (American Academy of Ophthalmology)",
    subtitle: "Global Perspectives in Vision Health and AI-driven Diagnostics",
    date: "2026-11-13",
    endDate: "2026-11-16",
    time: "08:00 - 17:30 (現地時間)",
    region: "海外",
    venue: "McCormick Place Convention Center, Chicago, IL",
    specialty: "一般眼科",
    eventType: "海外学会",
    format: "現地",
    sponsor: "American Academy of Ophthalmology",
    credits: "AMA PRA Category 1 Credits / 国際眼科学会認定",
    calendarStatus: {
      google: {
        status: "free",
        conflicts: []
      },
      icloud: {
        status: "free",
        conflicts: []
      },
      isAdded: false
    },
    officialUrl: "https://example.com/aao2026-chicago",
    pdfUrl: "aao2026_overview.pdf",
    tags: ["米科学会", "AI診断", "最新手術機器", "国際学会"],
    description: "世界最大の眼科学会年次集会。最新の眼科手術顕微鏡、ヘッドアップサージェリー、AI画像診断の世界的潮流を網羅。",
    isConference: true,
    period: "2026年11月13日(金) 〜 11月16日(月)",
    cityCountry: "シカゴ（イリノイ州） / 米国",
    abstractDeadline: "2026年4月14日(火) 締切済",
    earlyBirdDeadline: "2026年8月26日(水) 締切済"
  },
  {
    id: "oph-005",
    title: "プレミアムIOL徹底攻略：老視矯正と乱視軸合わせの極意",
    subtitle: "3焦点・EDOFレンズの適応判断とAngle Kappa・角膜高次収差の評価",
    date: "2026-11-07",
    endDate: "2026-11-07",
    time: "15:00 - 18:00",
    region: "中部",
    venue: "名古屋ミッドランドスクエア 会議室 / ライブ配信",
    specialty: "白内障",
    eventType: "講演会・勉強会",
    format: "ハイブリッド",
    sponsor: "中部屈折矯正白内障手術懇話会",
    credits: "日本眼科学会生涯教育 1.5単位",
    calendarStatus: {
      google: {
        status: "free",
        conflicts: []
      },
      icloud: {
        status: "free",
        conflicts: []
      },
      isAdded: true
    },
    officialUrl: "https://example.com/premium-iol-nagoya",
    pdfUrl: "iol_masterclass_2026.pdf",
    tags: ["多焦点眼内レンズ", "屈折矯正", "乱視矯正", "カレンダー登録済"],
    description: "白内障手術における術後不満足を防ぐ術前カウセリング術。EDOF/多焦点IOLの光学特性比較とトーリック軸補正の実際。",
    isConference: false
  },
  {
    id: "oph-006",
    title: "第37回 関西角膜・ドライアイ臨床研究会",
    subtitle: "マイボーム腺機能不全(MGD)の新規治療と角膜移植(DMEK/DSAEK)の最前線",
    date: "2026-11-14",
    endDate: "2026-11-14",
    time: "14:00 - 17:30",
    region: "関西",
    venue: "梅田スカイビル スペース36 / オンライン中継",
    specialty: "角膜・外眼部",
    eventType: "地方会・研究会",
    format: "ハイブリッド",
    sponsor: "近畿角膜疾患研究グループ",
    credits: "日本眼科学会 2単位",
    calendarStatus: {
      google: {
        status: "free",
        conflicts: []
      },
      icloud: {
        status: "free",
        conflicts: []
      },
      isAdded: false
    },
    officialUrl: "https://example.com/kansai-cornea-37",
    pdfUrl: "cornea_dryeye_kansai.pdf",
    tags: ["DMEK", "ドライアイ", "内皮移植", "生体共焦点顕微鏡"],
    description: "重症ドライアイ・MGDに対するIPL治療の実際と、水疱性角膜症に対する内皮移植（DMEK/DSAEK）の低侵襲手技解説。",
    isConference: false
  },
  {
    id: "oph-007",
    title: "小児眼科スクリーニングと斜視弱視治療の実際",
    subtitle: "屈折検査機器(スポットビジョンスクリーナー)の活用と不同視弱視の完全屈折矯正",
    date: "2026-11-21",
    endDate: "2026-11-21",
    time: "18:00 - 19:30",
    region: "全国Web",
    venue: "Web会議システム（Zoom）",
    specialty: "小児・斜視弱視",
    eventType: "講演会・勉強会",
    format: "Web",
    sponsor: "日本弱視斜視臨床懇話会",
    credits: "日本眼科学会専門医 1単位",
    calendarStatus: {
      google: {
        status: "free",
        conflicts: []
      },
      icloud: {
        status: "partial",
        conflicts: [
          { start: "18:00", end: "19:00", title: "当直引継ぎミーティング" }
        ]
      },
      isAdded: false
    },
    officialUrl: "https://example.com/pediatric-strabismus-web",
    pdfUrl: "pediatric_ophth_guide.pdf",
    tags: ["3歳児健診", "屈折異常", "アイパッチ遮閉", "専門医単位"],
    description: "乳幼児健診での弱視見逃しを防ぐフォトスクリーナーの導入効果と、アトロピン点眼・遮閉訓練の実践的プロトコル。",
    isConference: false
  },
  {
    id: "oph-008",
    title: "第42回 日本眼形成再建外科学会 学術集会 (JSOPRS 2026)",
    subtitle: "眼瞼下垂・眼窩骨折・甲状腺眼症の手術解剖と機能美の両立",
    date: "2026-12-05",
    endDate: "2026-12-06",
    time: "09:30 - 17:00",
    region: "九州・沖縄",
    venue: "福岡国際会議場（福岡県福岡市）",
    specialty: "眼形成",
    eventType: "国内学会",
    format: "現地",
    sponsor: "日本眼形成再建外科学会",
    credits: "日本眼科学会 4単位 / 形成外科学会後援",
    calendarStatus: {
      google: {
        status: "free",
        conflicts: []
      },
      icloud: {
        status: "free",
        conflicts: []
      },
      isAdded: false
    },
    officialUrl: "https://example.com/jsoprs-2026-fukuoka",
    pdfUrl: "jsoprs2026_fukuoka.pdf",
    tags: ["眼瞼下垂", "ミュラー筋短縮", "眼窩減圧術", "現地開催"],
    description: "眼形成分野の年次学術集会。挙筋腱膜前転術、ミュラー筋タッキングの手技供覧や、甲状腺眼症に対する分子標的薬・減圧術の検討。",
    isConference: true,
    period: "2026年12月5日(土) 〜 12月6日(日)",
    cityCountry: "福岡市（福岡県） / 日本",
    abstractDeadline: "2026年7月31日(金) 締切済",
    earlyBirdDeadline: "2026年10月15日(木) まで受付中"
  },
  {
    id: "oph-009",
    title: "神経眼科ケースカンファレンス：見落としてはならない視神経疾患",
    subtitle: "MOGAD/NMOSD関連視神経炎と虚血性視神経症(AION)の鑑別ポイント",
    date: "2026-12-10",
    endDate: "2026-12-10",
    time: "19:15 - 20:45",
    region: "関東",
    venue: "TKP東京駅カンファレンスセンター / Web同時配信",
    specialty: "神経眼科",
    eventType: "地方会・研究会",
    format: "ハイブリッド",
    sponsor: "首都圏神経眼科研究会",
    credits: "日本眼科学会生涯教育 1単位",
    calendarStatus: {
      google: {
        status: "busy",
        conflicts: [
          { start: "19:30", end: "21:00", title: "院内安全管理委員会" }
        ]
      },
      icloud: {
        status: "partial",
        conflicts: [
          { start: "19:00", end: "20:00", title: "医局抄読会" }
        ]
      },
      isAdded: false
    },
    officialUrl: "https://example.com/neuro-oph-case-conf",
    pdfUrl: "neuro_ophthalmology_case.pdf",
    tags: ["抗MOG抗体", "視神経乳頭浮腫", "MRI画像診断", "ステロイドパルス"],
    description: "急速な視力低下・視野欠損をきたす視神経炎の迅速な画像診断と抗体検査オーダーのタイミング、最新免疫療法を症例検討形式で解説。",
    isConference: false
  },
  {
    id: "oph-010",
    title: "APACRS 2026 (Asia-Pacific Association of Cataract & Refractive Surgeons)",
    subtitle: "Precision and Artistry in Anterior Segment Surgery",
    date: "2026-12-17",
    endDate: "2026-12-20",
    time: "08:30 - 18:00 (現地時間)",
    region: "海外",
    venue: "Suntec Singapore Convention & Exhibition Centre",
    specialty: "白内障",
    eventType: "海外学会",
    format: "現地",
    sponsor: "Asia-Pacific Association of Cataract and Refractive Surgeons",
    credits: "APACRS CME Credits / 国際単位",
    calendarStatus: {
      google: {
        status: "free",
        conflicts: []
      },
      icloud: {
        status: "free",
        conflicts: []
      },
      isAdded: false
    },
    officialUrl: "https://example.com/apacrs2026-singapore",
    pdfUrl: "apacrs2026_singapore.pdf",
    tags: ["アジア太平洋学会", "前眼部手術", "フェムトセカンドレーザー", "IOL脱臼"],
    description: "アジア太平洋地域の白内障屈折手術学会。難症例白内障（小瞳孔、Zinn小帯脆弱、角膜混濁）への対処法や最新の屈折矯正レーザー手技。",
    isConference: true,
    period: "2026年12月17日(木) 〜 12月20日(日)",
    cityCountry: "シンガポール / シンガポール共和国",
    abstractDeadline: "2026年8月10日(月) 締切済",
    earlyBirdDeadline: "2026年10月31日(土) まで受付中"
  },
  {
    id: "oph-001-s1",
    parentConferenceId: "oph-001",
    title: "【臨眼2026】ランチョンセミナー12：難治性黄斑疾患に対する抗VEGF治療の新展開",
    subtitle: "広角OCTAとバイオマーカーに基づく投与間隔延長プロトコル",
    date: "2026-10-23",
    endDate: "2026-10-23",
    time: "12:20 - 13:20",
    region: "関西",
    venue: "国立京都国際会館 第2会場（Room B-1）",
    specialty: "網膜・硝子体",
    eventType: "講演会・勉強会",
    format: "現地",
    sponsor: "第79回日本臨床眼科学会 / ノバルティス ファーマ株式会社",
    credits: "日本眼科学会生涯教育 1単位",
    calendarStatus: {
      google: {
        status: "free",
        conflicts: []
      },
      icloud: {
        status: "free",
        conflicts: []
      },
      isAdded: false
    },
    officialUrl: "https://example.com/ringan2026-luncheon12",
    pdfUrl: "ringan2026_luncheon12.pdf",
    tags: ["ランチョンセミナー", "抗VEGF", "黄斑変性", "臨眼2026共催"],
    description: "第79回日本臨床眼科学会 ランチョンセミナー。滲出型加齢黄斑変性およびPCVに対する高用量抗VEGF抗体の長期治療成績とtreat-and-extendレジメンの実際。",
    isConference: false
  },
  {
    id: "oph-001-s2",
    parentConferenceId: "oph-001",
    title: "【臨眼2026】モーニングセミナー3：緑内障手術ナビゲーション 〜低侵襲緑内障手術(MIGS)の極意〜",
    subtitle: "線維柱帯切開術マイクロフックとステント留置術の使い分け",
    date: "2026-10-24",
    endDate: "2026-10-24",
    time: "07:50 - 08:40",
    region: "関西",
    venue: "国立京都国際会館 第5会場（Room D）",
    specialty: "緑内障",
    eventType: "講演会・勉強会",
    format: "現地",
    sponsor: "第79回日本臨床眼科学会 / 参天製薬株式会社",
    credits: "日本眼科学会生涯教育 1単位",
    calendarStatus: {
      google: {
        status: "free",
        conflicts: []
      },
      icloud: {
        status: "free",
        conflicts: []
      },
      isAdded: false
    },
    officialUrl: "https://example.com/ringan2026-morning3",
    pdfUrl: "ringan2026_morning3.pdf",
    tags: ["モーニングセミナー", "MIGS", "緑内障手術", "臨眼2026共催"],
    description: "第79回日本臨床眼科学会 モーニングセミナー。流出路再建術におけるマイクロフックトラベクロトミーの手技と周術期眼圧管理。",
    isConference: false
  },
  {
    id: "oph-001-s3",
    parentConferenceId: "oph-001",
    title: "【臨眼2026】イブニングセミナー5：極小切開白内障手術と最新IOL固定手技",
    subtitle: "強膜内固定術(Yamane法)のトラブルシューティングと長期予後",
    date: "2026-10-24",
    endDate: "2026-10-24",
    time: "17:30 - 18:30",
    region: "関西",
    venue: "国立京都国際会館 第1会場（Main Hall）",
    specialty: "白内障",
    eventType: "講演会・勉強会",
    format: "現地",
    sponsor: "第79回日本臨床眼科学会 / アルコン ファーマ株式会社",
    credits: "日本眼科学会生涯教育 1単位",
    calendarStatus: {
      google: {
        status: "free",
        conflicts: []
      },
      icloud: {
        status: "free",
        conflicts: []
      },
      isAdded: false
    },
    officialUrl: "https://example.com/ringan2026-evening5",
    pdfUrl: "ringan2026_evening5.pdf",
    tags: ["イブニングセミナー", "強膜内固定", "Yamane法", "臨眼2026共催"],
    description: "第79回日本臨床眼科学会 イブニングセミナー。チン小帯脆弱例・IOL偏位に対するダブルニードル法による毛様溝強膜内固定の工夫と合併症対策。",
    isConference: false
  },
  {
    id: "oph-008-s1",
    parentConferenceId: "oph-008",
    title: "【JSOPRS 2026】共催セミナー1：眼瞼痙攣に対するボツリヌス療法と手術療法のハイブリッド戦略",
    subtitle: "難治例における眼輪筋切除術と施注テクニックの最適化",
    date: "2026-12-05",
    endDate: "2026-12-05",
    time: "12:00 - 13:00",
    region: "九州・沖縄",
    venue: "福岡国際会議場 第1会場",
    specialty: "眼形成",
    eventType: "講演会・勉強会",
    format: "現地",
    sponsor: "第42回日本眼形成再建外科学会 / グラクソ・スミスクライン株式会社",
    credits: "日本眼科学会 1単位",
    calendarStatus: {
      google: {
        status: "free",
        conflicts: []
      },
      icloud: {
        status: "free",
        conflicts: []
      },
      isAdded: false
    },
    officialUrl: "https://example.com/jsoprs2026-symposium1",
    pdfUrl: "jsoprs2026_symposium1.pdf",
    tags: ["共催セミナー", "ボツリヌス治療", "眼瞼痙攣", "JSOPRS共催"],
    description: "第42回日本眼形成再建外科学会 共催セミナー。ボツリヌス毒素A療法の効果減弱時の対応と、眼瞼形成術・開瞼失行に対する外科的アプローチ。",
    isConference: false
  }
];
