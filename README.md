# Pencil Blade Reconstruction

Kho lưu trữ này là bản phục dựng *Pencil Blade 1.5* theo phương pháp clean-room, dựa trên bằng chứng tĩnh. APK gốc không chạy được trên các thiết bị Android hiện đại mà dự án có thể kiểm chứng. APK và runtime gốc chỉ được dùng làm bằng chứng; sản phẩm phục dựng không chạy hoặc đóng gói lại runtime đó, đồng thời không tuyên bố giống hệt tuyệt đối với phiên bản lịch sử.

Mục tiêu của dự án là phục vụ học tập, nghiên cứu và bảo tồn. Phần mã phục dựng được công khai theo mô hình source-available, không phải open source theo định nghĩa OSI, và **không được dùng cho mục đích thương mại**.

Đây là dự án phục dựng không chính thức, không đại diện và không tuyên bố có liên kết với chủ sở hữu, nhà phát triển hoặc nhà phát hành ban đầu.

## Phạm vi

- Phục dựng hành vi và phần trình bày từ bằng chứng tĩnh, manifest tài nguyên và các contract đã trích xuất.
- Dùng Cocos Creator `3.8.8` + TypeScript làm nền tảng triển khai hiện tại.
- Chỉ hỗ trợ hai đầu ra kỹ thuật: Android debug APK nội bộ và Web Mobile H5.
- Không đóng gói APK gốc, `libgame.so`, emulator, compatibility layer hoặc runtime native cũ làm phụ thuộc khi chạy.
- Không khẳng định đã đo kiểm thực nghiệm để chứng minh sản phẩm giống hệt runtime gốc.

## Thành phần trong repo

| Khu vực | Vai trò |
|---|---|
| `game/` | Dự án Cocos Creator, mã TypeScript, scene và tài nguyên được đưa vào từ tập dữ liệu phục hồi |
| `docs/` | PDR, kiến trúc, khả năng tương thích, kiểm tra quyền, sổ bằng chứng và báo cáo phục dựng |
| `release/` | Hai manifest tách bạch việc bảo tồn với quyền phát hành công khai |
| `forensics/` | Bằng chứng tĩnh, contract và kết quả phân tích |
| `scripts/` | Công cụ audit, chuẩn bị tài nguyên và kiểm chứng bản build |

## Clean-room và nội dung hồi phục

Repo này tách rõ hai lớp:

1. **Phần triển khai clean-room**: mã TypeScript, scene, cấu hình, test và tài liệu do dự án phục dựng tạo ra.
2. **Nội dung phục hồi hoặc của bên thứ ba**: PNG, WAV, MP3, font, tên/nhận diện và mọi thành phần có nguồn gốc ngoài phần triển khai clean-room.

Việc repo được cấp phép phi thương mại **không tự động cấp quyền** tái phân phối các tài nguyên phục hồi hoặc nội dung bên thứ ba. Quyền phân phối từng tài nguyên vẫn phải đến từ chủ sở hữu hoặc nguồn hợp lệ tương ứng.

## Giấy phép

Phần nội dung mà các contributor thực sự sở hữu được cấp phép theo [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0). Đây là giấy phép source-available, không phải giấy phép open source được OSI phê duyệt.

- Cho phép nghiên cứu, thử nghiệm, học tập và các mục đích phi thương mại.
- Không cấp quyền sử dụng thương mại.
- Không giới hạn quyền fair use hoặc các quyền khác được pháp luật quy định.

Xem chi tiết ở [LICENSE](./LICENSE).

## Đầu ra được hỗ trợ

- Android debug APK nội bộ
- Web Mobile H5

## Tài liệu liên quan

- [Project Overview PDR](./docs/project-overview-pdr.md)
- [Code Standards](./docs/code-standards.md)
- [System Architecture](./docs/system-architecture.md)
- [GitHub Pages Deployment](./docs/deployment.md)
- [Codebase Summary](./docs/codebase-summary.md)
- [Compatibility Matrix](./docs/compatibility-matrix.md)
- [Release Rights Checklist](./docs/release-rights-checklist.md)
- [Evidence Register](./docs/evidence-register.md)
- [Reconstruction Report](./docs/reconstruction-report.md)

## Cách xem project

Mở thư mục `game/` bằng Cocos Creator `3.8.8`. Không có script build trong `game/package.json`, nên README này không đưa ra lệnh build chưa được repo xác minh.

## Ghi chú pháp lý

Nội dung trong repo được cung cấp như hiện trạng, không có bảo đảm. Tài liệu này không phải tư vấn pháp lý. Nếu bạn cần dùng lại tài sản, tên, thương hiệu, âm thanh, font, hoặc nội dung hồi phục trong ngữ cảnh khác, hãy kiểm tra quyền riêng cho từng mục trước khi phát hành.
