// 演示用业务单位数据(实际由维护界面录入,存 CloudBase units 集合)
// 字段对应设计:id / name / province / city / district / lng / lat / owner
export const mockUnits = [
  { id: 'u001', name: '北京总部结算中心', province: '北京市', city: '北京市', district: '东城区', lng: 116.41, lat: 39.9, owner: '王芳' },
  { id: 'u002', name: '北京海淀分公司', province: '北京市', city: '北京市', district: '海淀区', lng: 116.31, lat: 39.99, owner: '李强' },

  { id: 'u003', name: '上海陆家嘴中心', province: '上海市', city: '上海市', district: '浦东新区', lng: 121.54, lat: 31.22, owner: '张磊' },
  { id: 'u004', name: '上海徐汇分公司', province: '上海市', city: '上海市', district: '徐汇区', lng: 121.44, lat: 31.18, owner: '陈静' },
  { id: 'u005', name: '上海外滩支行', province: '上海市', city: '上海市', district: '黄浦区', lng: 121.49, lat: 31.24, owner: '刘洋' },

  { id: 'u006', name: '广州天河中心', province: '广东省', city: '广州市', district: '天河区', lng: 113.36, lat: 23.12, owner: '黄伟' },
  { id: 'u007', name: '深圳南山分公司', province: '广东省', city: '深圳市', district: '南山区', lng: 113.93, lat: 22.53, owner: '赵敏' },
  { id: 'u008', name: '深圳福田支行', province: '广东省', city: '深圳市', district: '福田区', lng: 114.06, lat: 22.54, owner: '周杰' },

  { id: 'u009', name: '杭州西湖中心', province: '浙江省', city: '杭州市', district: '西湖区', lng: 120.13, lat: 30.26, owner: '林娜' },
  { id: 'u010', name: '宁波鄞州分公司', province: '浙江省', city: '宁波市', district: '鄞州区', lng: 121.55, lat: 29.83, owner: '吴鹏' },

  { id: 'u011', name: '南京鼓楼中心', province: '江苏省', city: '南京市', district: '鼓楼区', lng: 118.77, lat: 32.07, owner: '孙莉' },
  { id: 'u012', name: '苏州工业园分公司', province: '江苏省', city: '苏州市', district: '工业园区', lng: 120.72, lat: 31.32, owner: '郑浩' },

  { id: 'u013', name: '成都高新中心', province: '四川省', city: '成都市', district: '高新区', lng: 104.07, lat: 30.55, owner: '钱多' },
  { id: 'u014', name: '成都锦江分公司', province: '四川省', city: '成都市', district: '锦江区', lng: 104.08, lat: 30.66, owner: '冯雪' },

  { id: 'u015', name: '武汉光谷中心', province: '湖北省', city: '武汉市', district: '洪山区', lng: 114.4, lat: 30.5, owner: '蒋勇' },

  { id: 'u016', name: '青岛市南分公司', province: '山东省', city: '青岛市', district: '市南区', lng: 120.38, lat: 36.07, owner: '韩梅' },
  { id: 'u017', name: '济南历下中心', province: '山东省', city: '济南市', district: '历下区', lng: 117.02, lat: 36.66, owner: '杨光' },

  { id: 'u018', name: '福州鼓楼分公司', province: '福建省', city: '福州市', district: '鼓楼区', lng: 119.3, lat: 26.08, owner: '朱琦' },
  { id: 'u019', name: '厦门思明中心', province: '福建省', city: '厦门市', district: '思明区', lng: 118.09, lat: 24.46, owner: '秦风' },

  { id: 'u020', name: '大连中山分公司', province: '辽宁省', city: '大连市', district: '中山区', lng: 121.64, lat: 38.92, owner: '许涛' },
  { id: 'u021', name: '沈阳和平中心', province: '辽宁省', city: '沈阳市', district: '和平区', lng: 123.42, lat: 41.79, owner: '邓丽' },

  { id: 'u022', name: '重庆渝中中心', province: '重庆市', city: '重庆市', district: '渝中区', lng: 106.57, lat: 29.55, owner: '曹宇' },

  { id: 'u023', name: '西安高新分公司', province: '陕西省', city: '西安市', district: '高新区', lng: 108.93, lat: 34.35, owner: '彭超' },

  { id: 'u024', name: '长沙岳麓中心', province: '湖南省', city: '长沙市', district: '岳麓区', lng: 112.93, lat: 28.23, owner: '董洁' },

  { id: 'u025', name: '天津和平分公司', province: '天津市', city: '天津市', district: '和平区', lng: 117.21, lat: 39.12, owner: '袁华' },

  { id: 'u026', name: '合肥蜀山中心', province: '安徽省', city: '合肥市', district: '蜀山区', lng: 117.26, lat: 31.86, owner: '邹敏' },

  { id: 'u027', name: '郑州金水分公司', province: '河南省', city: '郑州市', district: '金水区', lng: 113.66, lat: 34.8, owner: '田亮' },

  { id: 'u028', name: '昆明五华中心', province: '云南省', city: '昆明市', district: '五华区', lng: 102.7, lat: 25.05, owner: '夏雨' },

  { id: 'u029', name: '南宁青秀分公司', province: '广西壮族自治区', city: '南宁市', district: '青秀区', lng: 108.4, lat: 22.82, owner: '魏晨' },

  { id: 'u030', name: '乌鲁木齐天山中心', province: '新疆维吾尔自治区', city: '乌鲁木齐市', district: '天山区', lng: 87.62, lat: 43.83, owner: '方圆' },
]

// 当前周期初始已完成单位(演示:约 40% 已点亮)
export const mockInitialDone = [
  'u001', 'u003', 'u006', 'u009', 'u011',
  'u013', 'u016', 'u018', 'u020', 'u022',
  'u024', 'u026',
]
