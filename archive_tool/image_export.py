"""웹 export의 픽셀 처리: 리사이즈 + 실제 색공간 변환 (Pillow).

메타데이터(저작권 유지, GPS 제거)는 여기서 다루지 않는다 — exif_utils가
Pillow 저장 이후에 별도로 처리한다. Pillow로 JPEG를 저장하면 원본 EXIF가
날아가므로, 이 함수가 만든 결과물은 항상 exif_utils.copy_metadata_strip_gps로
후처리해야 한다.
"""

from __future__ import annotations

import io
from pathlib import Path

from PIL import Image, ImageCms

_SRGB_PROFILE = ImageCms.createProfile("sRGB")
_SRGB_ICC_BYTES = ImageCms.ImageCmsProfile(_SRGB_PROFILE).tobytes()


def _to_srgb(img: Image.Image) -> Image.Image:
    icc_bytes = img.info.get("icc_profile")
    if icc_bytes:
        try:
            src_profile = ImageCms.ImageCmsProfile(io.BytesIO(icc_bytes))
            return ImageCms.profileToProfile(img, src_profile, _SRGB_PROFILE, outputMode="RGB")
        except ImageCms.PyCMSError:
            pass
    # 임베드된 프로파일이 없으면 카메라 JPEG의 통상 관례대로 이미 sRGB라고 본다.
    return img.convert("RGB")


def export_image(source: Path, dest: Path, max_long_edge: int, quality: int) -> tuple[int, int]:
    """source를 sRGB로 변환하고 필요할 때만 축소해 dest에 JPEG로 저장한다.

    원본이 max_long_edge보다 작으면 키우지 않는다. (dest_width, dest_height)를 반환.
    """
    with Image.open(source) as opened:
        img = _to_srgb(opened)
        width, height = img.size
        long_edge = max(width, height)
        if long_edge > max_long_edge:
            scale = max_long_edge / long_edge
            img = img.resize((round(width * scale), round(height * scale)), Image.LANCZOS)

        dest.parent.mkdir(parents=True, exist_ok=True)
        img.save(dest, format="JPEG", quality=quality, icc_profile=_SRGB_ICC_BYTES)
        return img.size
