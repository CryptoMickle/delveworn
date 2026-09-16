"use client";

import { useId } from "react";

const MERCHANT_IMAGE = "/characters/merchant-quartermaster-kevin.webp";
const MERCHANT_IMAGE_WIDTH = 1672;
const MERCHANT_IMAGE_HEIGHT = 941;

/** Offsets from the existing room merchant anchor at the figure's feet. */
export const MERCHANT_ROOM_ART_LAYOUT = {
  person: { x: -52, y: -150, width: 104, height: 150 },
  stall: {
    y: -190,
    width: 190,
    height: 205,
    xByOuterSide: { left: 20, right: -210 },
  },
} as const;

const MERCHANT_OUTLINE =
  "M645 150 Q653 111 704 109 Q754 97 778 148 L779 190 Q804 199 796 235 L823 234 Q910 259 950 322 Q982 376 954 410 L919 451 L910 486 Q939 523 949 583 Q947 619 928 630 L861 656 L859 748 L824 804 L824 844 Q845 880 819 913 Q786 929 743 915 L733 898 L733 866 L721 826 L698 785 L674 764 L642 785 L628 839 L624 867 Q592 885 546 882 L513 869 Q504 853 530 845 L568 827 L581 794 L564 758 L540 699 L510 674 L489 675 L478 650 Q425 648 412 617 L420 579 L430 535 L447 502 L470 503 L477 471 L487 408 L497 376 L470 368 Q435 360 426 332 L423 291 L420 266 L424 249 L433 232 L447 222 L443 195 L462 191 L486 194 L479 227 L491 239 L494 269 L511 280 L548 279 L572 259 L600 244 L626 241 L650 218 L646 188Z";

// The connected canopy, counter, sign, cart and wheel. The merchant outline is
// cut back out because the original painting places him in front of the cart.
const MERCHANT_STALL_OUTLINE =
  "M820 150 C850 120 882 92 920 65 C958 38 999 18 1039 19 C1095 29 1156 48 1215 58 C1283 72 1349 95 1404 117 C1454 137 1483 169 1497 210 C1510 253 1513 313 1505 360 L1490 420 L1498 455 L1488 486 C1535 518 1572 570 1582 624 C1591 684 1563 735 1525 768 L1440 784 L1360 754 L1254 770 L1143 758 L1051 731 L969 724 L946 692 L953 633 L936 577 L930 521 L868 511 L830 475 L817 421 L808 371 L817 327 L802 282 L813 236 L798 190Z";

const MERCHANT_CHEST_OUTLINE =
  "M1148 778 Q1156 744 1198 731 L1368 731 Q1415 738 1428 774 L1437 881 Q1437 914 1408 925 L1174 925 Q1140 917 1137 887Z";

const MERCHANT_LEFT_SUPPLIES_OUTLINE =
  "M954 799 Q960 754 997 741 L1009 716 L1042 715 L1055 750 Q1092 733 1125 754 L1148 802 L1163 875 Q1144 902 1098 900 L1012 892 Q970 883 955 850Z";

const MERCHANT_RIGHT_SUPPLIES_OUTLINE =
  "M1431 789 Q1446 755 1475 749 L1505 731 L1540 747 L1563 724 L1597 731 L1618 770 L1625 878 Q1608 912 1564 916 L1471 904 Q1435 887 1427 846Z";

function MerchantImage({ clipId, maskId }: { clipId: string; maskId?: string }) {
  return (
    <image
      href={MERCHANT_IMAGE}
      width={MERCHANT_IMAGE_WIDTH}
      height={MERCHANT_IMAGE_HEIGHT}
      clipPath={`url(#${clipId})`}
      mask={maskId ? `url(#${maskId})` : undefined}
    />
  );
}

function MerchantCutoutMask({ id }: { id: string }) {
  return (
    <mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={MERCHANT_IMAGE_WIDTH} height={MERCHANT_IMAGE_HEIGHT}>
      <rect width={MERCHANT_IMAGE_WIDTH} height={MERCHANT_IMAGE_HEIGHT} fill="white" />
      <path d={MERCHANT_OUTLINE} fill="black" />
    </mask>
  );
}

/** Kevin's original full-body painting, isolated so callers may face him inward. */
export function MerchantSprite({ className }: { className?: string } = {}) {
  const id = useId();

  return (
    <svg className={className} viewBox="399 94 575 836" aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <path d={MERCHANT_OUTLINE} />
        </clipPath>
      </defs>
      <MerchantImage clipId={id} />
    </svg>
  );
}

/**
 * Kevin's original wagon, readable sign and foreground stock. Keep this layer
 * unmirrored; only MerchantSprite should turn when Kevin changes room sides.
 */
export function MerchantStallSprite({ className }: { className?: string } = {}) {
  const stallId = useId();
  const merchantMaskId = useId();

  return (
    <svg className={className} viewBox="785 8 855 925" aria-hidden="true">
      <defs>
        <clipPath id={stallId}>
          <path d={MERCHANT_STALL_OUTLINE} />
          <path d={MERCHANT_CHEST_OUTLINE} />
          <path d={MERCHANT_LEFT_SUPPLIES_OUTLINE} />
          <path d={MERCHANT_RIGHT_SUPPLIES_OUTLINE} />
        </clipPath>
        <MerchantCutoutMask id={merchantMaskId} />
      </defs>
      <MerchantImage clipId={stallId} maskId={merchantMaskId} />
    </svg>
  );
}

/** Full shop portrait for panels, assembled from the same two room layers. */
export function MerchantShopArtwork({ className }: { className?: string } = {}) {
  const stallId = useId();
  const merchantId = useId();
  const merchantMaskId = useId();

  return (
    <svg className={className} viewBox="360 8 1280 925" aria-hidden="true">
      <defs>
        <clipPath id={stallId}>
          <path d={MERCHANT_STALL_OUTLINE} />
          <path d={MERCHANT_CHEST_OUTLINE} />
          <path d={MERCHANT_LEFT_SUPPLIES_OUTLINE} />
          <path d={MERCHANT_RIGHT_SUPPLIES_OUTLINE} />
        </clipPath>
        <clipPath id={merchantId}>
          <path d={MERCHANT_OUTLINE} />
        </clipPath>
        <MerchantCutoutMask id={merchantMaskId} />
      </defs>
      <MerchantImage clipId={stallId} maskId={merchantMaskId} />
      <MerchantImage clipId={merchantId} />
    </svg>
  );
}
