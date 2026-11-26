import type { ElementId } from '../../game/elements';

type CountryNames = {
  country: string;
  emergency: string;
  yorishiro: string;
  treasury: string;
  resource: Record<ElementId, string>;
  mission: Record<ElementId, string>;
};

export const STYLE_NAMES = {
  china: {
    country: '中華風',
    emergency: '集いの金鈴楼',
    yorishiro: '五彩の宿り閣',
    treasury: '金瓦の宝蔵',
    resource: { fire: '朱炎', water: '碧流', earth: '黄土れんが', wind: '風鳴り竹', thunder: '紫雷晶' },
    mission: { fire: '朱炉の火加減', water: '碧池の網すくい', earth: '黄土の型押し', wind: '雲風をためる', thunder: '夜道の灯籠点し' },
  },
  europe: {
    country: '洋風',
    emergency: '村はずれの鐘楼',
    yorishiro: '宿り木の小屋',
    treasury: '王さまの石蔵',
    resource: { fire: '暖炉の種火', water: '泉のしずく', earth: '丘の陶土', wind: 'そよぎ草', thunder: '星鳴り石' },
    mission: { fire: '暖炉のぬくもり番', water: '小川の網すくい', earth: '陶土のかたち作り', wind: '風車に風をためる', thunder: '星あかりのランプ点し' },
  },
  comic: {
    country: 'アメコミ風',
    emergency: 'コール・タワー',
    yorishiro: 'ボディ・ポータル',
    treasury: 'シティ・ボルト',
    resource: { fire: 'ヒート・コア', water: 'スプラッシュ水', earth: 'テラ・クレイ', wind: 'エア・パフ', thunder: 'ボルト鉱石' },
    mission: { fire: 'ヒートをキープ！', water: 'ネットで魚をキャッチ！', earth: 'クレイを型にプレス！', wind: 'エアをチャージ！', thunder: '暗がりをライトアップ！' },
  },
} satisfies Record<string, CountryNames>;
