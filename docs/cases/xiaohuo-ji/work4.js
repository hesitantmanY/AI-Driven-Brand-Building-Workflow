/* ============================================================
 xiaohuo-ji / work4 — 营销组合 4P
 数据源：docs/demo-data.js xiaohuo.work4（cases/ 拆分迁移，2026-09-01）。
 形状匹配 Work4.defaultData()；defaultData 比本数据新增的字段
 （如 ppp/fxSensitivity/localChannelRelations/adoptedSegments）由 Cases.load deepMerge 兜底。
 ============================================================ */
(function(){
  const data = {
  "route": {
    "scope": "domestic",
    "oemType": "OBM",
    "entryMode": "offline-first",
    "light": [],
    "politicalPower": ""
  },
  "product": {
    "name": "小镬记粤菜融合系列",
    "description": "30 年老店+粤菜融合+明厨亮灶+主厨手作",
    "coreDifferentiators": [
      "30 年老店信任",
      "主厨手作",
      "食材原产地溯源",
      "融合菜创新"
    ],
    "physicalFeatures": "明厨亮灶 / 食材二维码溯源 / 老陈手作纪录片 / 融合菜季度上新",
    "serviceOffering": "等位茶点+主厨讲解 / 食材故事小程序页 / 会员积分+生日券 / 私域社群",
    "technologyMoat": "5 位粤菜师傅 + 荔湾老店品牌资产 + 小陈互联网运营",
    "skus": [
      {
        "name": "招牌粤菜 15 道",
        "specs": "清远鸡/顺德鱼生/蜜汁叉烧等",
        "price_range": "68-188 元/道",
        "differentiator": "30 年老店配方"
      },
      {
        "name": "融合菜季度上新",
        "specs": "粤菜+日料/西式/东南亚",
        "price_range": "88-268 元/道",
        "differentiator": "小陈主导研发"
      },
      {
        "name": "家庭套餐",
        "specs": "4-6 人 8-10 道",
        "price_range": "588-1288 元/套",
        "differentiator": "食材溯源+主厨讲解"
      },
      {
        "name": "主厨手作体验",
        "specs": "1.5 小时 8 道菜",
        "price_range": "298-498 元/位",
        "differentiator": "主厨面对面"
      }
    ]
  },
  "price": {
    "strategy": "value",
    "strategyNote": "中端定价，融合菜承担溢价；家庭套餐+主厨体验提升客单。",
    "tiers": [
      {
        "name": "招牌粤菜单道",
        "targetSegment": "老客+家庭",
        "price": 128,
        "unit": "元/道",
        "notes": "清远鸡等招牌"
      },
      {
        "name": "融合菜单道",
        "targetSegment": "年轻白领+博主",
        "price": 168,
        "unit": "元/道",
        "notes": "季度上新"
      },
      {
        "name": "家庭套餐",
        "targetSegment": "家庭客",
        "price": 888,
        "unit": "元/套",
        "notes": "4-6 人 8-10 道"
      },
      {
        "name": "主厨体验",
        "targetSegment": "高端客+团建",
        "price": 398,
        "unit": "元/位",
        "notes": "1.5 小时"
      }
    ],
    "channelPricing": [
      {
        "channel": "堂食",
        "priceAdjustment": "原价",
        "rationale": "主战场"
      },
      {
        "channel": "美团/大众点评",
        "priceAdjustment": "9 折团购",
        "rationale": "拉新引流"
      },
      {
        "channel": "抖音同城号",
        "priceAdjustment": "套餐立减 50",
        "rationale": "种草转化"
      }
    ],
    "promotions": [
      {
        "occasion": "老店周年庆",
        "discount": "招牌菜 8 折",
        "period": "周年庆当月"
      },
      {
        "occasion": "新店开业",
        "discount": "双人套餐 5 折",
        "period": "开业首月"
      }
    ],
    "competitorPrices": "广州酒家 150；点都德 80；炳胜 200；太兴 90；gaga 120"
  },
  "place": {
    "onlineSelf": [
      "小镬记小程序",
      "抖音同城号旗舰店"
    ],
    "onlineThird": [
      "美团",
      "大众点评",
      "小红书企业号"
    ],
    "onlineNotes": "小程序会员+预约为主；美团/点评做拉新；抖音同城号种草",
    "offlineDirect": [
      "荔湾老店",
      "珠江新城店",
      "深圳新店（拟）",
      "上海新店（拟）"
    ],
    "offlineDistrib": [],
    "offlineRetail": [],
    "offlineNotes": "直营连锁为主，第一阶段不开放加盟",
    "keyPartners": [
      {
        "name": "小红书探店 KOC",
        "side": "线上"
      },
      {
        "name": "抖音同城 MCN",
        "side": "线上"
      },
      {
        "name": "清远/顺德食材基地",
        "side": "线下"
      }
    ],
    "channelIncentives": "KOC 免单+佣金 10%；MCN 坑位费 + GMV 提成 5%",
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
            "name": "抖音同城",
            "share": 20
          }
        ]
      },
      {
        "name": "线下",
        "children": [
          {
            "name": "广州本店",
            "share": 60
          },
          {
            "name": "深圳新店",
            "share": 25
          },
          {
            "name": "上海新店",
            "share": 15
          }
        ]
      }
    ]
  },
  "promotion": {
    "theme": "30 年老店，新派粤菜",
    "advertising": [
      {
        "media": "抖音同城短视频",
        "budgetShare": 35,
        "message": "老陈手作+融合菜",
        "kpi": "同城曝光/团购 GMV"
      },
      {
        "media": "小红书 KOC",
        "budgetShare": 30,
        "message": "出片+主厨互动",
        "kpi": "互动率/UGC"
      },
      {
        "media": "大众点评/美团",
        "budgetShare": 20,
        "message": "9 折团购+招牌菜",
        "kpi": "到店转化率"
      },
      {
        "media": "私域社群",
        "budgetShare": 15,
        "message": "老客回馈+新菜试吃",
        "kpi": "复购率"
      }
    ],
    "pr": [
      {
        "event": "老陈手作纪录片上线",
        "timing": "30 周年庆",
        "expectedReach": "同城 100 万曝光"
      },
      {
        "event": "融合菜发布会",
        "timing": "每季度 1 次",
        "expectedReach": "小红书/同城 50 万"
      }
    ],
    "salesPromotion": [
      {
        "tactic": "美团 9 折团购",
        "mechanic": "招牌菜+融合菜",
        "period": "常年"
      },
      {
        "tactic": "老客 8 折日",
        "mechanic": "会员日",
        "period": "每月 1 次"
      }
    ],
    "crm": {
      "tool": "小程序+企业微信",
      "membership": "消费满 1000 升级银卡/满 5000 金卡",
      "repurchase": "每 30 天推送新菜/活动",
      "notes": "老客复购是基本盘"
    },
    "contentStrategy": "抖音\"老陈手作 30 年\"系列 + 小红书\"融合菜出片\"系列 + 大众点评\"食材故事\"长图。"
  }
};

  if(typeof window!== 'undefined') window.__case_xiaohuo_ji_work4 = data;
})();
