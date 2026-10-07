/* ============================================================
 hengrui-zao / work4 — 营销组合 4P
 数据源：docs/demo-data.js hengrui.work4（cases/ 拆分迁移，2026-09-01）。
 形状匹配 Work4.defaultData()；defaultData 比本数据新增的字段
 （如 ppp/fxSensitivity/localChannelRelations/adoptedSegments）由 Cases.load deepMerge 兜底。
 ============================================================ */
(function(){
  const data = {
  "route": {
    "scope": "domestic",
    "oemType": "OBM",
    "entryMode": "direct",
    "light": [],
    "politicalPower": ""
  },
  "product": {
    "name": "恒锐造精密件自有品牌",
    "description": "0.005mm 精度+24h 打样+医疗资质+一站式后处理",
    "coreDifferentiators": [
      "0.005mm 精度",
      "24h 打样",
      "医疗资质（ISO 13485）",
      "一站式后处理",
      "小批量柔性"
    ],
    "physicalFeatures": "30+ 台 CNC / SPC 体系 / ISO 9001+IATF 16949+ISO 13485 / 第三方检测报告",
    "serviceOffering": "24h 打样响应 / 工艺文档辅导 / 认证辅导 / 长期账期 / 技术支持",
    "technologyMoat": "30+ 年精密件经验 + 30+ 台 CNC + 5 套检测设备 + 医疗资质",
    "skus": [
      {
        "name": "汽车变速箱精密件",
        "specs": "精度 0.005mm",
        "price_range": "加工费 50-150 元/件",
        "differentiator": "IATF 16949+长期合作"
      },
      {
        "name": "医疗器械精密件",
        "specs": "精度 0.005mm",
        "price_range": "加工费 80-250 元/件",
        "differentiator": "ISO 13485+认证辅导"
      },
      {
        "name": "消费电子精密件",
        "specs": "精度 0.01mm",
        "price_range": "加工费 30-100 元/件",
        "differentiator": "小批量柔性+24h 打样"
      },
      {
        "name": "机器人精密件",
        "specs": "精度 0.005mm",
        "price_range": "加工费 80-200 元/件",
        "differentiator": "国产替代+柔性"
      }
    ]
  },
  "price": {
    "strategy": "value",
    "strategyNote": "中端定价，以\"精度+交期+资质\"承担溢价；专精特新渠道商给渠道价。",
    "tiers": [
      {
        "name": "汽车件加工费",
        "targetSegment": "一汽/汽车厂",
        "price": 80,
        "unit": "元/件",
        "notes": "BOM+加工费"
      },
      {
        "name": "医疗件加工费",
        "targetSegment": "迈瑞/医疗厂",
        "price": 150,
        "unit": "元/件",
        "notes": "含认证辅导"
      },
      {
        "name": "消费电子件",
        "targetSegment": "美的/3C 厂",
        "price": 60,
        "unit": "元/件",
        "notes": "小批量起订"
      },
      {
        "name": "机器人件加工费",
        "targetSegment": "机器人厂",
        "price": 120,
        "unit": "元/件",
        "notes": "国产替代"
      }
    ],
    "channelPricing": [
      {
        "channel": "直销团队",
        "priceAdjustment": "原价",
        "rationale": "主战场"
      },
      {
        "channel": "阿里 1688",
        "priceAdjustment": "9 折",
        "rationale": "拉新引流"
      },
      {
        "channel": "专精特新渠道商",
        "priceAdjustment": "渠道价 7 折",
        "rationale": "长期合作"
      }
    ],
    "promotions": [
      {
        "occasion": "SIMM/CIMT 展会",
        "discount": "打样 5 折",
        "period": "展会期间"
      },
      {
        "occasion": "专精特新认证客户",
        "discount": "首批合作 9 折",
        "period": "签约后 3 月内"
      }
    ],
    "competitorPrices": "长盈精密 80-200；震裕科技 60-150；科达制造 50-120；拓斯达 70-180；绿的谐波 100-300"
  },
  "place": {
    "onlineSelf": [
      "恒锐精密官网",
      "恒锐造小程序",
      "恒锐造公众号"
    ],
    "onlineThird": [
      "阿里 1688",
      "京东工业",
      "中国制造网"
    ],
    "onlineNotes": "官网+小程序为主阵地（案例墙+SPC 报告+认证展示）；1688 做拉新；行业展会做品牌发布",
    "offlineDirect": [
      "东莞工厂直销",
      "深圳/苏州/宁波销售点"
    ],
    "offlineDistrib": [
      "专精特新渠道商",
      "行业展会（SIMM/CIMT）"
    ],
    "offlineRetail": [],
    "offlineNotes": "直销团队+渠道商双线，第一阶段以 B 端为主",
    "keyPartners": [
      {
        "name": "专精特新渠道商 10+",
        "side": "线下"
      },
      {
        "name": "阿里 1688 工业品牌",
        "side": "线上"
      },
      {
        "name": "SIMM/CIMT 展会",
        "side": "线下"
      }
    ],
    "channelIncentives": "渠道商佣金 10%+年返 2%；直销奖金按 GMV 5%",
    "structure": [
      {
        "name": "线上",
        "children": [
          {
            "name": "官网/小程序",
            "share": 50
          },
          {
            "name": "阿里 1688",
            "share": 30
          },
          {
            "name": "京东工业/中国制造",
            "share": 20
          }
        ]
      },
      {
        "name": "线下",
        "children": [
          {
            "name": "直销团队",
            "share": 50
          },
          {
            "name": "专精特新渠道商",
            "share": 25
          },
          {
            "name": "行业展会",
            "share": 25
          }
        ]
      }
    ]
  },
  "promotion": {
    "theme": "恒锐造，0.005mm 的精密",
    "advertising": [
      {
        "media": "行业展会（SIMM/CIMT）",
        "budgetShare": 35,
        "message": "恒锐造品牌发布+案例展示",
        "kpi": "签约客户数"
      },
      {
        "media": "阿里 1688/京东工业",
        "budgetShare": 25,
        "message": "24h 打样+案例",
        "kpi": "询盘转化率"
      },
      {
        "media": "官网/小程序",
        "budgetShare": 20,
        "message": "案例墙+认证展示",
        "kpi": "留资率"
      },
      {
        "media": "销售团队+客户走访",
        "budgetShare": 20,
        "message": "长期合作+定制方案",
        "kpi": "签约率"
      }
    ],
    "pr": [
      {
        "event": "恒锐造品牌发布会（SIMM 展）",
        "timing": "2027 年 3 月",
        "expectedReach": "行业 10 万专业人士"
      },
      {
        "event": "专精特新认证案例发布",
        "timing": "每季度 1 次",
        "expectedReach": "渠道 5 万+"
      }
    ],
    "salesPromotion": [
      {
        "tactic": "展会打样 5 折",
        "mechanic": "现场签单",
        "period": "展会期间"
      },
      {
        "tactic": "首批合作 9 折",
        "mechanic": "专精特新认证客户",
        "period": "签约后 3 月"
      }
    ],
    "crm": {
      "tool": "企业微信+CRM 系统",
      "membership": "战略客户/白银/黄金/钻石",
      "repurchase": "每季度推送新工艺/案例",
      "notes": "B 端客户长期关系为重"
    },
    "contentStrategy": "官网\"恒锐造案例墙\"系列 + 公众号\"0.005mm 的精密\"长文 + 行业展会\"工艺纪录片\"。"
  }
};

  if(typeof window!== 'undefined') window.__case_hengrui_zao_work4 = data;
})();
