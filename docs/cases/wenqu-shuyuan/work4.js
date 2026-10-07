/* ============================================================
 wenqu-shuyuan / work4 — 营销组合 4P
 数据源：docs/demo-data.js wenqu.work4（cases/ 拆分迁移，2026-09-01）。
 形状匹配 Work4.defaultData()；defaultData 比本数据新增的字段
 （如 ppp/fxSensitivity/localChannelRelations/adoptedSegments）由 Cases.load deepMerge 兜底。
 ============================================================ */
(function(){
  const data = {
  "route": {
    "scope": "domestic",
    "oemType": "OBM",
    "entryMode": "omnichannel",
    "light": [],
    "politicalPower": ""
  },
  "product": {
    "name": "问渠书院素质+职业双线课程",
    "description": "K12 素质+职业培训双线，老师稳定+作品集+就业推荐",
    "coreDifferentiators": [
      "老师稳定承诺",
      "学员作品集",
      "就业推荐合作",
      "学习报告可视化"
    ],
    "physicalFeatures": "5 年老师司龄 / 师徒制 / 3 校区直营 / 线上线下混合 / 小程序学习报告",
    "serviceOffering": "0 元试听 / 1v1 职业规划 / 学习进度反馈 / 就业社群 / 老学员推荐奖励",
    "technologyMoat": "5 年办学经验 + 8 位全职老师 + 教务体系 + 本地企业合作",
    "skus": [
      {
        "name": "K12 编程年课",
        "specs": "48 课时",
        "price_range": "5800-8800 元/年",
        "differentiator": "老师稳定+作品集"
      },
      {
        "name": "K12 美术年课",
        "specs": "48 课时",
        "price_range": "5800-9800 元/年",
        "differentiator": "老师稳定+作品集"
      },
      {
        "name": "数字媒体职业课",
        "specs": "3 个月 96 课时",
        "price_range": "6800-9800 元/期",
        "differentiator": "作品集+就业推荐"
      },
      {
        "name": "电商运营职业课",
        "specs": "3 个月 96 课时",
        "price_range": "4800-7800 元/期",
        "differentiator": "实战项目+合作企业"
      }
    ]
  },
  "price": {
    "strategy": "value",
    "strategyNote": "K12 中端定价+老客续费优惠；职业线中高端定价，以\"作品集+就业推荐\"承担溢价。",
    "tiers": [
      {
        "name": "K12 单科年课",
        "targetSegment": "K12 家长",
        "price": 7800,
        "unit": "元/年",
        "notes": "编程/美术/口才"
      },
      {
        "name": "K12 双科包",
        "targetSegment": "鸡娃家长",
        "price": 13800,
        "unit": "元/年",
        "notes": "任选两科 9 折"
      },
      {
        "name": "数字媒体职业课",
        "targetSegment": "大学生/职场新人",
        "price": 8800,
        "unit": "元/期",
        "notes": "3 个月 96 课时"
      },
      {
        "name": "电商运营职业课",
        "targetSegment": "转行者/副业",
        "price": 6800,
        "unit": "元/期",
        "notes": "3 个月 96 课时"
      }
    ],
    "channelPricing": [
      {
        "channel": "校区直营",
        "priceAdjustment": "原价",
        "rationale": "主战场"
      },
      {
        "channel": "美团/大众点评",
        "priceAdjustment": "9 折试听卡",
        "rationale": "拉新引流"
      },
      {
        "channel": "抖音/小红书",
        "priceAdjustment": "职业课 9 折",
        "rationale": "种草转化"
      }
    ],
    "promotions": [
      {
        "occasion": "暑期班",
        "discount": "K12 双科包立减 1000",
        "period": "6-8 月"
      },
      {
        "occasion": "老学员推荐",
        "discount": "推荐 1 人各得 500",
        "period": "常年"
      }
    ],
    "competitorPrices": "编程猫 6000-12000；核桃编程 4000-9000；开课吧 5000-15000；三节课 3000-8000；黑马 8000-20000"
  },
  "place": {
    "onlineSelf": [
      "问渠小程序",
      "问渠官网"
    ],
    "onlineThird": [
      "美团",
      "大众点评",
      "抖音企业号",
      "小红书企业号",
      "B 站"
    ],
    "onlineNotes": "小程序为主阵地（学习报告+作品墙+试听预约）；美团/点评做拉新；抖音/小红书/B 站种草",
    "offlineDirect": [
      "杭州西湖校区",
      "宁波校区",
      "绍兴校区"
    ],
    "offlineDistrib": [],
    "offlineRetail": [],
    "offlineNotes": "3 校区直营，第一阶段不开放加盟；职业课与 K12 共享校区",
    "keyPartners": [
      {
        "name": "本地 3-5 家合作企业（就业内推）",
        "side": "线下"
      },
      {
        "name": "小红书 KOC",
        "side": "线上"
      },
      {
        "name": "抖音教育 MCN",
        "side": "线上"
      }
    ],
    "channelIncentives": "KOC 试听课免费+佣金 10%；MCN 坑位费 + GMV 提成 5%",
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
            "share": 25
          },
          {
            "name": "抖音/小红书",
            "share": 25
          }
        ]
      },
      {
        "name": "线下",
        "children": [
          {
            "name": "杭州校区",
            "share": 45
          },
          {
            "name": "宁波校区",
            "share": 30
          },
          {
            "name": "绍兴校区",
            "share": 25
          }
        ]
      }
    ]
  },
  "promotion": {
    "theme": "问渠书院，成长陪伴",
    "advertising": [
      {
        "media": "抖音短视频",
        "budgetShare": 30,
        "message": "老师稳定+学员作品",
        "kpi": "GMV/试听转化"
      },
      {
        "media": "小红书 KOC",
        "budgetShare": 25,
        "message": "学员成长案例",
        "kpi": "互动率/到店"
      },
      {
        "media": "美团/点评",
        "budgetShare": 20,
        "message": "9 折试听",
        "kpi": "到店率"
      },
      {
        "media": "私域社群",
        "budgetShare": 25,
        "message": "老学员推荐+学习报告",
        "kpi": "续费率/转介绍"
      }
    ],
    "pr": [
      {
        "event": "学员作品展+就业案例发布会",
        "timing": "每季度 1 次",
        "expectedReach": "同城 30 万家庭/学员群体"
      },
      {
        "event": "老师司龄纪念+师徒签约",
        "timing": "每年 9 月",
        "expectedReach": "本地 10 万家长群体"
      }
    ],
    "salesPromotion": [
      {
        "tactic": "老学员推荐有奖",
        "mechanic": "推荐 1 人各得 500",
        "period": "常年"
      },
      {
        "tactic": "暑期班双科包立减 1000",
        "mechanic": "K12 双科",
        "period": "6-8 月"
      }
    ],
    "crm": {
      "tool": "小程序+企业微信+教务系统",
      "membership": "银卡（消费 5000）/金卡（消费 15000）/钻石卡（消费 30000）",
      "repurchase": "每 90 天推送续费/新课程",
      "notes": "老客续费是基本盘"
    },
    "contentStrategy": "抖音\"老师司龄 5 年\"系列 + 小红书\"学员成长档案\"系列 + 公众号\"学习报告\"长图。"
  }
};

  if(typeof window!== 'undefined') window.__case_wenqu_shuyuan_work4 = data;
})();
