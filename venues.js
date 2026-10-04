/** 共通会場マスター。空配列 / null は未調査。仕様: docs/venue-master.md */
const venueMaster = {
  "tokyo-international-forum": {
    "venueId": "tokyo-international-forum",
    "name": "東京国際フォーラム",
    "city": "千代田区",
    "prefecture": "東京都",
    "country": "日本",
    "googleMaps": {
      "searchQuery": "東京国際フォーラム 東京都 千代田区"
    },
    "access": {
      "nearestStations": [],
      "shinkansenStations": [],
      "airports": [],
      "transportModes": [],
      "taxiEstimate": null,
      "morningCrowdingNotes": []
    },
    "accommodation": {
      "recommendedAreas": [],
      "hotels": []
    }
  },
  "pacifico-yokohama": {
    "venueId": "pacifico-yokohama",
    "name": "パシフィコ横浜",
    "city": "横浜市",
    "prefecture": "神奈川県",
    "country": "日本",
    "googleMaps": {
      "searchQuery": "パシフィコ横浜 神奈川県 横浜市"
    },
    "access": {
      "nearestStations": [],
      "shinkansenStations": [],
      "airports": [],
      "transportModes": [],
      "taxiEstimate": null,
      "morningCrowdingNotes": []
    },
    "accommodation": {
      "recommendedAreas": [],
      "hotels": []
    }
  },
  "kyoto-international-conference-center": {
    "venueId": "kyoto-international-conference-center",
    "name": "国立京都国際会館",
    "city": "京都市",
    "prefecture": "京都府",
    "country": "日本",
    "googleMaps": {
      "searchQuery": "国立京都国際会館 京都府 京都市"
    },
    "access": {
      "nearestStations": [],
      "shinkansenStations": [],
      "airports": [],
      "transportModes": [],
      "taxiEstimate": null,
      "morningCrowdingNotes": []
    },
    "accommodation": {
      "recommendedAreas": [],
      "hotels": []
    }
  },
  "osaka-international-convention-center": {
    "venueId": "osaka-international-convention-center",
    "name": "大阪国際会議場",
    "city": "大阪市",
    "prefecture": "大阪府",
    "country": "日本",
    "googleMaps": {
      "searchQuery": "大阪国際会議場 大阪府 大阪市"
    },
    "access": {
      "nearestStations": [],
      "shinkansenStations": [],
      "airports": [],
      "transportModes": [],
      "taxiEstimate": null,
      "morningCrowdingNotes": []
    },
    "accommodation": {
      "recommendedAreas": [],
      "hotels": []
    }
  },
  "kobe-international-conference-center": {
    "venueId": "kobe-international-conference-center",
    "name": "神戸国際会議場",
    "city": "神戸市",
    "prefecture": "兵庫県",
    "country": "日本",
    "googleMaps": {
      "searchQuery": "神戸国際会議場 兵庫県 神戸市"
    },
    "access": {
      "nearestStations": [],
      "shinkansenStations": [],
      "airports": [],
      "transportModes": [],
      "taxiEstimate": null,
      "morningCrowdingNotes": []
    },
    "accommodation": {
      "recommendedAreas": [],
      "hotels": []
    }
  },
  "fukuoka-international-congress-center": {
    "venueId": "fukuoka-international-congress-center",
    "name": "福岡国際会議場",
    "city": "福岡市",
    "prefecture": "福岡県",
    "country": "日本",
    "googleMaps": {
      "searchQuery": "福岡国際会議場 福岡県 福岡市"
    },
    "access": {
      "nearestStations": [],
      "shinkansenStations": [],
      "airports": [],
      "transportModes": [],
      "taxiEstimate": null,
      "morningCrowdingNotes": []
    },
    "accommodation": {
      "recommendedAreas": [],
      "hotels": []
    }
  }
};

function getEventVenue(event) {
  return Object.hasOwn(venueMaster, event.venueId) ? venueMaster[event.venueId] : null;
}

// イベント固有の部屋名や配信併記を保持する。
function getEventVenueName(event) {
  return event.venue || getEventVenue(event)?.name || "";
}
