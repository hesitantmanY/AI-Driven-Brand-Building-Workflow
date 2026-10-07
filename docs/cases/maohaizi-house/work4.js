/* ============================================================
 maohaizi-house / work4 — 营销组合 4P
 数据源：docs/demo-data.js maohaizi.work4（cases/ 拆分迁移，2026-09-01）。
 形状匹配 Work4.defaultData()；defaultData 比本数据新增的字段
 （如 ppp/fxSensitivity/localChannelRelations/adoptedSegments）由 Cases.load deepMerge 兜底。
 ============================================================ */
(function(){
  const data = {
  "route": {
    "scope": "domestic",
    "oemType": "OBM",
    "entryMode": "online-first",
    "light": [],
    "politicalPower": ""
  },
  "product": {
    "name": "毛孩子之家宠物服务",
    "description": "专业洗护+无应激环境+实时寄养直播+联名摄影",
    "coreDifferentiators": [
      "洗护师 CKU 认证",
      "无应激低噪环境",
      "实时寄养直播",
      "单宠独立用具",
      "联名宠物摄影"
    ],
    "physicalFeatures": "CKU/NGKC 认证 / 无应激设备 / 24h 直播摄像头 / 独立单宠用具 / 联名摄影",
    "serviceOffering": "专业洗护 / 24h 寄养直播 / 接送服务 / 联名摄影 / 会员月卡 / 异业合作",
    "technologyMoat": "CKU 认证洗护师团队 + 2 家店私域社群 + 实时直播 SaaS",
    "skus": [
      {
        "name": "基础洗护",
        "specs": "1.5 小时",
        "price_range": "80-200 元",
        "differentiator": "CKU 认证洗护师"
      },
      {
        "name": "无应激 SPA",
        "specs": "2 小时",
        "price_range": "200-300 元",
        "differentiator": "独立单宠+低噪"
      },
      {
        "name": "寄养 24h 直播",
        "specs": "1 天起",
        "price_range": "100-250 元/天",
        "differentiator": "24h 实时直播"
      },
      {
        "name": "会员月卡",
        "specs": "4 次洗护+2 次寄养",
        "price_range": "980 元/月",
        "differentiator": "跨店通用"
      }
    ]
  },
  "price": {
    "strategy": "value",
    "strategyNote": "中端定价，会员月卡+联名摄影提升复购与客单。",
    "tiers": [
      {
        "name": "基础洗护",
        "targetSegment": "新手铲屎官",
        "price": 128,
        "unit": "元/次",
        "notes": "CKU 认证"
      },
      {
        "name": "无应激 SPA",
        "targetSegment": "猫主子家长",
        "price": 238,
        "unit": "元/次",
        "notes": "独立单宠"
      },
      {
        "name": "寄养 24h 直播",
        "targetSegment": "出差/家庭客",
        "price": 168,
        "unit": "元/天",
        "notes": "24h 直播+反馈"
      },
      {
        "name": "会员月卡",
        "targetSegment": "复购客",
        "price": 980,
        "unit": "元/月",
        "notes": "4 次洗护+2 次寄养"
      }
    ],
    "channelPricing": [
      {
        "channel": "美团/大众点评",
        "priceAdjustment": "9 折团购",
        "rationale": "拉新引流"
      },
      {
        "channel": "抖音同城",
        "priceAdjustment": "套餐立减 30",
        "rationale": "种草转化"
      },
      {
        "channel": "私域社群",
        "priceAdjustment": "会员月卡 9 折",
        "rationale": "老客粘性"
      }
    ],
    "promotions": [
      {
        "occasion": "618 宠物节",
        "discount": "会员月卡 8 折",
        "period": "6 月"
      },
      {
        "occasion": "新店开业",
        "discount": "洗护 5 折",
        "period": "开业首月"
      }
    ],
    "competitorPrices": "新瑞鹏 100-300；宠物家 80-200；圣宠 60-150；宠宠熊 50-150；爱诺 100-250"
  },
  "place": {
    "onlineSelf": [
      "毛孩子之家小程序",
      "抖音同城号旗舰店"
    ],
    "onlineThird": [
      "美团",
      "大众点评",
      "小红书企业号",
      "抖音同城",
      "异业合作（宠物医院/猫舍）"
    ],
    "onlineNotes": "小程序为主阵地（会员+直播+预约）；美团/点评做拉新；抖音同城种草；异业合作扩客",
    "offlineDirect": [
      "成都高新店",
      "成都锦江店",
      "成都新店 1（拟）",
      "成都新店 2（拟）",
      "重庆新店（拟）"
    ],
    "offlineDistrib": [],
    "offlineRetail": [],
    "offlineNotes": "5 家直营连锁，第一阶段不开放加盟；川渝同城为主",
    "keyPartners": [
      {
        "name": "小红书养宠 KOC",
        "side": "线上"
      },
      {
        "name": "抖音同城 MCN",
        "side": "线上"
      },
      {
        "name": "本地宠物医院/猫舍（异业）",
        "side": "线下"
      },
      {
        "name": "CKU 认证机构",
        "side": "线下"
      }
    ],
    "channelIncentives": "KOC 体验券+佣金 10%；MCN 坑位费 + GMV 提成 5%；异业互换优惠券",
    "structure": [
      {
        "name": "线上",
        "children": [
          {
            "name": "小程序",
            "share": 50
          },
          {
            "name": "美团/点评",
            "share": 30
          },
          {
            "name": "抖音/小红书",
            "share": 20
          }
        ]
      },
      {
        "name": "线下",
        "children": [
          {
            "name": "成都门店",
            "share": 75
          },
          {
            "name": "重庆门店",
            "share": 20
          },
          {
            "name": "其他川渝",
            "share": 5
          }
        ]
      }
    ]
  },
  "promotion": {
    "theme": "毛孩子放心，毛孩子之家",
    "advertising": [
      {
        "media": "抖音同城短视频",
        "budgetShare": 35,
        "message": "无应激洗护+实时直播",
        "kpi": "同城曝光/团购 GMV"
      },
      {
        "media": "小红书 KOC",
        "budgetShare": 30,
        "message": "养宠真实体验",
        "kpi": "互动率/UGC"
      },
      {
        "media": "美团/大众点评",
        "budgetShare": 20,
        "message": "9 折团购+会员月卡",
        "kpi": "到店转化率"
      },
      {
        "media": "私域社群",
        "budgetShare": 15,
        "message": "老客回馈+新店开业",
        "kpi": "复购率/老带新"
      }
    ],
    "pr": [
      {
        "event": "毛孩子之家新店开业+CKU 认证发布",
        "timing": "2027 年 3-6 月",
        "expectedReach": "同城 50 万养宠群体"
      },
      {
        "event": "联名宠物摄影展",
        "timing": "每季度 1 次",
        "expectedReach": "同城 20 万"
      }
    ],
    "salesPromotion": [
      {
        "tactic": "美团 9 折团购",
        "mechanic": "基础洗护",
        "period": "常年"
      },
      {
        "tactic": "会员月卡 9 折",
        "mechanic": "私域社群",
        "period": "618/双 11"
      }
    ],
    "crm": {
      "tool": "小程序+企业微信+门店 SaaS",
      "membership": "银卡（消费 1000）/金卡（消费 3000）/钻石卡（消费 6000）",
      "repurchase": "每 30 天推送洗护/活动",
      "notes": "老客复购是基本盘"
    },
    "contentStrategy": "抖音\"无应激洗护+实时直播\"系列 + 小红书\"科学养宠\"系列 + 公众号\"CKU 认证洗护师\"长文。"
  }
};

  if(typeof window!== 'undefined') window.__case_maohaizi_house_work4 = data;
})();
