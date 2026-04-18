const RESTRICTED_KEYWORDS = [
  // Tobacco — products
  'cigar', 'cigars', 'cigarillo', 'cigarillos', 'cigarette', 'cigarettes',
  'backwoods', 'swisher', 'dutch masters', 'black & mild', 'black and mild',
  'phillies', 'garcia vega', 'white owl', 'optimo',
  // Tobacco — types
  'tobacco', 'chew', 'dip', 'snuff', 'snus', 'hookah', 'shisha',
  'blunt', 'blunts', 'wrap', 'wraps', 'rolling paper',
  // Vape / nicotine
  'vape', 'vaping', 'e-cigarette', 'e-cig', 'ecig', 'juul', 'pod mod',
  'nicotine', 'nic', 'zyn', 'on! nicotine', 'velo', 'rogue nicotine',
  // Alcohol — general
  'beer', 'ale', 'lager', 'stout', 'porter', 'ipa', 'hard seltzer',
  'hard cider', 'malt', 'malt beverage', 'truly', 'white claw',
  // Alcohol — wine
  'wine', 'wines', 'vino', 'champagne', 'prosecco', 'rosé', 'rose wine',
  // Alcohol — spirits
  'whiskey', 'whisky', 'bourbon', 'scotch', 'vodka', 'gin', 'rum',
  'tequila', 'mezcal', 'brandy', 'cognac', 'sake', 'liquor', 'spirits',
  'fireball', 'hennessy', 'jack daniel', 'crown royal', 'grey goose',
  'patron', 'jose cuervo', 'bacardi', 'captain morgan',
]

export function isRestrictedProduct(name: string): boolean {
  const lower = name.toLowerCase()
  return RESTRICTED_KEYWORDS.some(kw => lower.includes(kw))
}
