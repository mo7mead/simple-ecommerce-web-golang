import type { ComponentType } from 'react'
import type { SvgIconProps } from '@mui/material'

import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined'
import DevicesOutlined from '@mui/icons-material/DevicesOutlined'
import LaptopMacOutlined from '@mui/icons-material/LaptopMacOutlined'
import PhoneIphoneOutlined from '@mui/icons-material/PhoneIphoneOutlined'
import HeadphonesOutlined from '@mui/icons-material/HeadphonesOutlined'
import WatchOutlined from '@mui/icons-material/WatchOutlined'
import CameraAltOutlined from '@mui/icons-material/CameraAltOutlined'
import TvOutlined from '@mui/icons-material/TvOutlined'
import VideogameAssetOutlined from '@mui/icons-material/VideogameAssetOutlined'
import ComputerOutlined from '@mui/icons-material/ComputerOutlined'
import KeyboardOutlined from '@mui/icons-material/KeyboardOutlined'
import KitchenOutlined from '@mui/icons-material/KitchenOutlined'
import WeekendOutlined from '@mui/icons-material/WeekendOutlined'
import ChairOutlined from '@mui/icons-material/ChairOutlined'
import BedOutlined from '@mui/icons-material/BedOutlined'
import BathtubOutlined from '@mui/icons-material/BathtubOutlined'
import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined'
import HomeOutlined from '@mui/icons-material/HomeOutlined'
import RestaurantOutlined from '@mui/icons-material/RestaurantOutlined'
import LocalCafeOutlined from '@mui/icons-material/LocalCafeOutlined'
import LocalBarOutlined from '@mui/icons-material/LocalBarOutlined'
import IcecreamOutlined from '@mui/icons-material/IcecreamOutlined'
import CakeOutlined from '@mui/icons-material/CakeOutlined'
import LocalPizzaOutlined from '@mui/icons-material/LocalPizzaOutlined'
import FastfoodOutlined from '@mui/icons-material/FastfoodOutlined'
import SportsSoccerOutlined from '@mui/icons-material/SportsSoccerOutlined'
import SportsBasketballOutlined from '@mui/icons-material/SportsBasketballOutlined'
import SportsBaseballOutlined from '@mui/icons-material/SportsBaseballOutlined'
import FitnessCenterOutlined from '@mui/icons-material/FitnessCenterOutlined'
import PetsOutlined from '@mui/icons-material/PetsOutlined'
import ChildCareOutlined from '@mui/icons-material/ChildCareOutlined'
import ToysOutlined from '@mui/icons-material/ToysOutlined'
import DiamondOutlined from '@mui/icons-material/DiamondOutlined'
import DirectionsCarOutlined from '@mui/icons-material/DirectionsCarOutlined'
import TwoWheelerOutlined from '@mui/icons-material/TwoWheelerOutlined'
import LocalShippingOutlined from '@mui/icons-material/LocalShippingOutlined'
import CheckroomOutlined from '@mui/icons-material/CheckroomOutlined'
import LocalFloristOutlined from '@mui/icons-material/LocalFloristOutlined'
import SpaOutlined from '@mui/icons-material/SpaOutlined'
import HealingOutlined from '@mui/icons-material/HealingOutlined'
import BookOutlined from '@mui/icons-material/BookOutlined'
import AutoStoriesOutlined from '@mui/icons-material/AutoStoriesOutlined'
import LibraryMusicOutlined from '@mui/icons-material/LibraryMusicOutlined'
import MovieOutlined from '@mui/icons-material/MovieOutlined'
import ShoppingBagOutlined from '@mui/icons-material/ShoppingBagOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import PaletteOutlined from '@mui/icons-material/PaletteOutlined'
import BrushOutlined from '@mui/icons-material/BrushOutlined'
import ConstructionOutlined from '@mui/icons-material/ConstructionOutlined'
import HardwareOutlined from '@mui/icons-material/HardwareOutlined'
import HomeRepairServiceOutlined from '@mui/icons-material/HomeRepairServiceOutlined'
import LocalGroceryStoreOutlined from '@mui/icons-material/LocalGroceryStoreOutlined'
import LocalPharmacyOutlined from '@mui/icons-material/LocalPharmacyOutlined'
import LocalLaundryServiceOutlined from '@mui/icons-material/LocalLaundryServiceOutlined'
import ScienceOutlined from '@mui/icons-material/ScienceOutlined'
import BiotechOutlined from '@mui/icons-material/BiotechOutlined'
import SchoolOutlined from '@mui/icons-material/SchoolOutlined'
import BackpackOutlined from '@mui/icons-material/BackpackOutlined'

export interface CategoryIconDef {
  id: string
  label: string
  keywords: string
  Component: ComponentType<SvgIconProps>
}

export const ICONS: CategoryIconDef[] = [
  { id: 'box', label: 'Box', keywords: 'box package inventory parcel', Component: Inventory2Outlined },
  { id: 'storefront', label: 'Store', keywords: 'store shop market', Component: StorefrontOutlined },
  { id: 'bag', label: 'Bag', keywords: 'bag shopping tote', Component: ShoppingBagOutlined },
  { id: 'grocery', label: 'Grocery', keywords: 'grocery cart trolley supermarket', Component: LocalGroceryStoreOutlined },

  { id: 'devices', label: 'Devices', keywords: 'devices gadgets electronics', Component: DevicesOutlined },
  { id: 'laptop', label: 'Laptop', keywords: 'laptop notebook computer', Component: LaptopMacOutlined },
  { id: 'phone', label: 'Phone', keywords: 'phone mobile smartphone', Component: PhoneIphoneOutlined },
  { id: 'headphones', label: 'Headphones', keywords: 'headphones audio music sound', Component: HeadphonesOutlined },
  { id: 'watch', label: 'Watch', keywords: 'watch smartwatch wearable', Component: WatchOutlined },
  { id: 'camera', label: 'Camera', keywords: 'camera photo photography', Component: CameraAltOutlined },
  { id: 'tv', label: 'TV', keywords: 'tv television display', Component: TvOutlined },
  { id: 'gaming', label: 'Gaming', keywords: 'gaming videogame controller', Component: VideogameAssetOutlined },
  { id: 'computer', label: 'Computer', keywords: 'computer desktop pc', Component: ComputerOutlined },
  { id: 'keyboard', label: 'Keyboard', keywords: 'keyboard typing input', Component: KeyboardOutlined },

  { id: 'home', label: 'Home', keywords: 'home house', Component: HomeOutlined },
  { id: 'kitchen', label: 'Kitchen', keywords: 'kitchen fridge appliance', Component: KitchenOutlined },
  { id: 'sofa', label: 'Sofa', keywords: 'sofa couch furniture', Component: WeekendOutlined },
  { id: 'chair', label: 'Chair', keywords: 'chair seat furniture', Component: ChairOutlined },
  { id: 'bed', label: 'Bed', keywords: 'bed bedroom mattress', Component: BedOutlined },
  { id: 'bathtub', label: 'Bathroom', keywords: 'bathtub bathroom bath', Component: BathtubOutlined },
  { id: 'lighting', label: 'Lighting', keywords: 'light lamp bulb', Component: LightbulbOutlined },
  { id: 'laundry', label: 'Laundry', keywords: 'laundry washing machine', Component: LocalLaundryServiceOutlined },

  { id: 'food', label: 'Food', keywords: 'food restaurant meal', Component: RestaurantOutlined },
  { id: 'cafe', label: 'Cafe', keywords: 'cafe coffee tea drink', Component: LocalCafeOutlined },
  { id: 'bar', label: 'Bar', keywords: 'bar drinks beer wine', Component: LocalBarOutlined },
  { id: 'icecream', label: 'Ice cream', keywords: 'icecream dessert', Component: IcecreamOutlined },
  { id: 'cake', label: 'Cake', keywords: 'cake bakery dessert', Component: CakeOutlined },
  { id: 'pizza', label: 'Pizza', keywords: 'pizza italian', Component: LocalPizzaOutlined },
  { id: 'fastfood', label: 'Fast food', keywords: 'fastfood burger snack', Component: FastfoodOutlined },

  { id: 'soccer', label: 'Soccer', keywords: 'soccer football sports', Component: SportsSoccerOutlined },
  { id: 'basketball', label: 'Basketball', keywords: 'basketball sports', Component: SportsBasketballOutlined },
  { id: 'baseball', label: 'Baseball', keywords: 'baseball sports', Component: SportsBaseballOutlined },
  { id: 'fitness', label: 'Fitness', keywords: 'fitness gym workout dumbbell', Component: FitnessCenterOutlined },

  { id: 'pets', label: 'Pets', keywords: 'pets dog cat animal', Component: PetsOutlined },
  { id: 'baby', label: 'Baby', keywords: 'baby child kids', Component: ChildCareOutlined },
  { id: 'toys', label: 'Toys', keywords: 'toys games kids', Component: ToysOutlined },
  { id: 'school', label: 'School', keywords: 'school education student', Component: SchoolOutlined },
  { id: 'backpack', label: 'Backpack', keywords: 'backpack bag school', Component: BackpackOutlined },

  { id: 'jewelry', label: 'Jewelry', keywords: 'jewelry diamond ring gem', Component: DiamondOutlined },
  { id: 'clothing', label: 'Clothing', keywords: 'clothing apparel fashion shirt', Component: CheckroomOutlined },
  { id: 'beauty', label: 'Beauty', keywords: 'beauty spa cosmetic', Component: SpaOutlined },
  { id: 'health', label: 'Health', keywords: 'health pharmacy medicine', Component: LocalPharmacyOutlined },
  { id: 'healing', label: 'Healing', keywords: 'healing bandage care', Component: HealingOutlined },
  { id: 'flowers', label: 'Flowers', keywords: 'flowers florist garden', Component: LocalFloristOutlined },

  { id: 'car', label: 'Car', keywords: 'car vehicle auto', Component: DirectionsCarOutlined },
  { id: 'moto', label: 'Moto', keywords: 'motorcycle bike scooter', Component: TwoWheelerOutlined },
  { id: 'shipping', label: 'Shipping', keywords: 'shipping delivery truck', Component: LocalShippingOutlined },

  { id: 'book', label: 'Book', keywords: 'book novel reading', Component: BookOutlined },
  { id: 'library', label: 'Library', keywords: 'books library reading', Component: AutoStoriesOutlined },
  { id: 'music', label: 'Music', keywords: 'music sound song', Component: LibraryMusicOutlined },
  { id: 'movie', label: 'Movie', keywords: 'movie film cinema', Component: MovieOutlined },

  { id: 'art', label: 'Art', keywords: 'art palette painting', Component: PaletteOutlined },
  { id: 'brush', label: 'Brush', keywords: 'brush paint design', Component: BrushOutlined },
  { id: 'tools', label: 'Tools', keywords: 'tools construction handyman', Component: ConstructionOutlined },
  { id: 'hardware', label: 'Hardware', keywords: 'hardware hammer wrench', Component: HardwareOutlined },
  { id: 'repair', label: 'Repair', keywords: 'repair service maintenance', Component: HomeRepairServiceOutlined },

  { id: 'science', label: 'Science', keywords: 'science lab chemistry', Component: ScienceOutlined },
  { id: 'biotech', label: 'Biotech', keywords: 'biotech bio dna lab', Component: BiotechOutlined },
]

export const ICON_MAP: Record<string, CategoryIconDef> =
  Object.fromEntries(ICONS.map((i) => [i.id, i]))

export function CategoryIcon({
  name, size = 18, sx,
}: { name?: string | null; size?: number; sx?: SvgIconProps['sx'] }) {
  if (!name) return null
  const def = ICON_MAP[name]
  if (def) {
    const C = def.Component
    return <C sx={{ fontSize: size, ...(sx as object) }} />
  }
  // Backwards-compatible fallback: render the stored string (e.g. legacy emoji).
  return <span style={{ fontSize: size, lineHeight: 1 }}>{name}</span>
}
