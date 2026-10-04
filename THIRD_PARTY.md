# Third-party assets and attribution

## MVTec Anomaly Detection (MVTec AD)

Dataset by Paul Bergmann, Michael Fauser, David Sattlegger, and Carsten Steger / MVTec Software GmbH.

- Official source: https://www.mvtec.com/company/research/datasets/mvtec-ad
- Paper: Bergmann et al., “MVTec AD — A Comprehensive Real-World Dataset for Unsupervised Anomaly Detection,” CVPR 2019, pp. 9592–9600.
- Paper URL: https://openaccess.thecvf.com/content_CVPR_2019/html/Bergmann_MVTec_AD_--_A_Comprehensive_Real-World_Dataset_for_Unsupervised_Anomaly_CVPR_2019_paper.html
- Mirror: https://huggingface.co/datasets/Voxel51/mvtec-ad
- Pinned mirror revision: `30a183a3b96e3aef953f230784b123b719b09d97`
- License: **Creative Commons Attribution-NonCommercial-ShareAlike 4.0**.
- Full license is included in `docs/MVTec_LICENSE.txt`.

Sample PNGs are resized to 256 × 256 from the mirror images. They retain the dataset license. Their source mapping is in `samples/provenance.json`. The training-data manifest records the source URLs and SHA256 checksums of resized files. The included memory bank is derived from MVTec AD; treat it as noncommercial and subject to the dataset's attribution/share-alike conditions. This package is intended for education and research showcasing; the source-code MIT license does not override these asset terms.

## ImageNet pretrained ResNet18

Backbone provided by PyTorch TorchVision: https://download.pytorch.org/models/resnet18-f37072fd.pth

Architecture: He et al., “Deep Residual Learning for Image Recognition,” CVPR 2016.

TorchVision code license: BSD 3-Clause (see `docs/TORCHVISION_LICENSE.txt`). PyTorch documents that pretrained models may have their own training-data-derived terms: https://github.com/pytorch/vision#models. No exclusive ownership of pretrained weights or their training data is claimed.

## Method

This implementation uses frozen multiscale features, a seeded random projection, random memory subsampling, and nearest-neighbor distances. It is inspired by patch-memory anomaly detection, but does **not** implement the complete published PatchCore algorithm (no greedy coreset or reweighting). It must not be labeled official PatchCore or state of the art.
