const ASSET_NAMES = [
  'ship.svg',
  'bullet.svg',
];

const assets: {[image: string]: HTMLImageElement} = {};

function downloadAsset(assetName: string) {
  return new Promise<void>((resolve) => {
    const asset = new Image();
    asset.onload = () => {
      console.log(`Downloaded ${assetName}`);
      assets[assetName] = asset;
      resolve();
    };
    asset.src = `/assets/${assetName}`;
  });
}

export function downloadAssets(): Promise<void[]> {
  return Promise.all(ASSET_NAMES.map(downloadAsset));
}

export const getAsset = (assetName: string) => {
  return assets[assetName];
}
