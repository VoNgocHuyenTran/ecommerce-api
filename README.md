# Hướng dẫn từng bước: REST API thương mại điện tử MVP

Tài liệu này hướng dẫn đọc, cấu hình, chạy và kiểm tra dự án theo sơ đồ database được cung cấp. Mỗi bước gồm **mục tiêu**, **việc cần làm**, **cách kiểm tra** và **đánh giá khách quan**. Chỉ chuyển sang bước kế tiếp khi kết quả kiểm tra đạt.

## Kết quả cần đạt

Cuối hướng dẫn, ứng dụng chạy bằng Node.js, Express, Prisma và PostgreSQL, đồng thời:

1. Đọc cấu hình từ `.env`.
2. Xác thực người dùng bằng JWT và phân quyền admin.
3. Chạy ứng dụng và PostgreSQL bằng Docker Compose.
4. Báo trạng thái health dựa trên kết nối PostgreSQL thật.

## Bước 1 — Kiểm tra công cụ

**Mục tiêu:** bảo đảm máy có Node.js, npm và Docker Compose trước khi cài hoặc chạy dự án.

Mở PowerShell tại thư mục `ecommerce-api`, chạy:

```powershell
node --version
npm --version
docker compose version
```

**Kiểm tra:** cả ba lệnh phải in ra số phiên bản, không báo “command not found” hoặc không kết nối được Docker daemon. Dự án dùng Node.js 22 trở lên.

**Đánh giá:** đạt khi đủ Node.js, npm và Docker hoạt động. Nếu Docker chưa chạy, mở Docker Desktop rồi chạy lại `docker compose version`.

## Bước 2 — Cấu hình biến môi trường

**Mục tiêu:** không ghi password hoặc JWT secret trực tiếp vào mã nguồn.

Mở PowerShell tại thư mục `ecommerce-api`. Tạo file cấu hình cá nhân:

```powershell
if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
} else {
  Write-Output ".env đã tồn tại; giữ nguyên và chỉ sửa các giá trị cần thiết."
}
notepad .env
```

Trong `.env`, thay các giá trị mẫu:

```dotenv
NODE_ENV=development
PORT=13000
DATABASE_URL=postgresql://ecommerce:ecommerce_dev_password@localhost:5432/ecommerce?schema=public
JWT_SECRET=thay_bang_chuoi_bi_mat_ngau_nhien_dai_tu_32_ky_tu_tro_len
JWT_EXPIRES_IN=1d
POSTGRES_PASSWORD=thay_bang_mat_khau_postgres_rieng
ADMIN_USERNAME=admin
ADMIN_FULLNAME=Store Administrator
ADMIN_PASSWORD=thay_bang_mat_khau_admin_dai_tu_12_ky_tu_tro_len
```

`POSTGRES_PASSWORD` là password PostgreSQL được Docker Compose sử dụng. `DATABASE_URL` ở trên dành cho kết nối từ máy phát triển; container API tự dùng hostname nội bộ `db`. `JWT_SECRET` phải có ít nhất 32 ký tự và `ADMIN_PASSWORD` ít nhất 12 ký tự. Không chia sẻ hoặc commit `.env`.

**Kiểm tra:** chạy:

```powershell
Test-Path .env
Select-String -Path .gitignore -Pattern '^\s*\.env\s*$'
```

Lệnh thứ nhất phải trả `True`; lệnh thứ hai phải tìm được dòng `.env` trong `.gitignore`.

**Đánh giá:** đạt khi `.env` có các giá trị bí mật riêng và không bị git theo dõi. Giữ nguyên `.env.example` để làm mẫu; không đưa password thật vào file đó.

## Bước 3 — Cài thư viện và kiểm tra mô hình database

**Mục tiêu:** cài đúng dependencies và xác nhận mô hình Prisma khớp các bảng, khóa và quan hệ trong sơ đồ.

Cài dependencies đúng theo lockfile và kiểm tra schema:

```powershell
npm ci
npx prisma validate
npm run db:generate
```

Các model được khai báo trong `prisma/schema.prisma`:

- `Role` và `MemberShip`: một vai trò/hạng thành viên có thể thuộc về nhiều người dùng.
- `User`: liên kết bắt buộc tới một `Role` và một `MemberShip`; lưu password đã băm.
- `Order`: thuộc về một người dùng.
- `OrderDetail`: dòng hàng của đơn; khóa chính ghép `(oid, pid)` và lưu `unit_price` tại thời điểm đặt hàng.
- `Product`: chứa giá và số lượng tồn kho.
- `Shipment`: thuộc về đơn hàng.

Migration đã chuẩn bị trong `prisma/migrations/`. `prisma.config.ts` nạp `.env` bằng `dotenv/config` rồi đọc `DATABASE_URL`, nên các lệnh Prisma CLI chạy trực tiếp từ thư mục dự án không cần tự nạp biến môi trường.

**Kiểm tra:** `prisma validate` phải báo schema hợp lệ; `prisma generate` phải sinh Prisma Client thành công. Nếu lệnh nào báo lỗi, sửa lỗi trước khi đi tiếp.

**Đánh giá:** đạt khi schema hợp lệ và Prisma Client được sinh ra. Đây là kiểm tra cấu trúc; database chưa được tạo cho tới bước kế tiếp.

## Bước 4 — Tạo database và chạy ứng dụng với Docker Compose

**Mục tiêu:** chạy PostgreSQL và API trong hai container; tạo bảng từ migration và khởi tạo dữ liệu ban đầu.

Chạy tại thư mục dự án:

```powershell
docker compose up --build -d
docker compose ps
```

Compose đợi database khỏe trước khi khởi động API. Container API tự áp dụng migration, seed hai role `normal`/`admin` và membership `normal` với `score = 10`, sau đó tạo tài khoản admin theo `.env`.

**Kiểm tra:** chờ trạng thái của cả `db` và `api` là `healthy`:

```powershell
docker compose ps
Invoke-RestMethod http://localhost:13000/healthz
```

Kết quả endpoint mong đợi:

```json
{"status":"ok","database":"connected"}
```

Nếu cổng `3000` đang bận, đổi `PORT` trong `.env` (ví dụ `13000`), chạy lại `docker compose up --build -d`, rồi kiểm tra `http://localhost:13000/healthz`.

**Đánh giá:** đạt khi hai container khỏe và endpoint trả `status: ok`, `database: connected`. Chỉ thấy server phản hồi mà database không kết nối được thì chưa đạt.

Dừng ứng dụng nhưng giữ lại dữ liệu PostgreSQL:

```powershell
docker compose down
```

Chỉ khi muốn xóa cả dữ liệu database đã lưu mới dùng `docker compose down --volumes`.

## Bước 5 — Khởi động API và kiểm tra health check

**Mục tiêu:** hiểu health check kiểm tra cả HTTP server lẫn database, thay vì chỉ báo server đang mở cổng.

Khi đang dùng Docker Compose, mở `http://localhost:13000/healthz` như bước 4. Nếu đổi `PORT` trong `.env`, thay cổng URL theo cấu hình đó. Trong `src/app.js`, endpoint `/healthz` chạy truy vấn `SELECT 1`; Compose cũng gọi endpoint đó định kỳ để xác định trạng thái container API. Container PostgreSQL có health check riêng bằng `pg_isready`.

Nếu chạy trực tiếp trên máy thay vì Docker, hãy bật PostgreSQL, cài dependencies và chạy:

```powershell
npm ci
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Lúc này `DATABASE_URL` trong `.env` phải kết nối được tới PostgreSQL trên máy. Server development đọc cổng từ `PORT` trong `.env`; file mẫu dùng cổng `13000`.

**Kiểm tra:** gọi `/healthz`. Khi database hoạt động phải nhận HTTP 200 và `"database":"connected"`. Nếu database dừng, health check phải thất bại thay vì giả vờ khỏe.

**Đánh giá:** đạt khi health check phản ánh được tình trạng database. Không chạy đồng thời server local và container trên cùng một cổng.

## Bước 6 — Đăng ký, đăng nhập và bảo vệ bằng JWT

**Mục tiêu:** người dùng đăng ký thành khách hàng; password được băm bằng bcrypt; API phát JWT cho những request cần xác thực.

Tiếp tục trong cùng cửa sổ PowerShell để dùng lại các biến `$base`, `$customer`, `$admin`, `$product`, `$order` và `$shipment` ở các bước sau.

Đặt URL gốc của API:

```powershell
$base = "http://localhost:13000"
```

Đăng ký tài khoản thử trong PowerShell:

```powershell
$customer = Invoke-RestMethod -Method Post `
  -Uri "$base/api/v1/auth/register" `
  -ContentType "application/json" `
  -Body (@{
    username = "demo-customer"
    fullname = "Demo Customer"
    password = "demo-customer-password-2026"
  } | ConvertTo-Json)
```

Username là duy nhất trong database. Nếu đã đăng ký `demo-customer` trước đó, hãy đổi sang một tên khác.

Đăng nhập bằng tài khoản vừa đăng ký. Response hiển thị token JWT; các bước tiếp theo dùng token được lưu trong `$customer.token`:

```powershell
$customer = Invoke-RestMethod -Method Post `
  -Uri "$base/api/v1/auth/login" `
  -ContentType "application/json" `
  -Body (@{
    username = $customer.user.username
    password = "demo-customer-password-2026"
  } | ConvertTo-Json)
$customer
```

Kiểm tra danh tính với token vừa nhận:

```powershell
Invoke-RestMethod -Uri "$base/api/v1/auth/me" `
  -Headers @{ Authorization = "Bearer $($customer.token)" }
```

**Kiểm tra:** đăng ký trả HTTP 201; tài khoản mới có role `normal`, membership `normal` và score `10`. Đăng nhập trả HTTP 200 cùng JWT; `/auth/me` trả người dùng cùng membership. Gọi `/api/v1/auth/me` không có token phải trả HTTP 401. Dùng password ngắn hơn 12 ký tự phải bị từ chối.

**Đánh giá:** đạt khi tài khoản trả role `normal`, membership `normal` với score `10`, token đăng nhập truy cập được route bảo vệ và request thiếu token bị từ chối.

Để thử đăng nhập bằng admin đã được seed:

```powershell
$admin = Invoke-RestMethod -Method Post `
  -Uri "$base/api/v1/auth/login" `
  -ContentType "application/json" `
  -Body (@{
    username = "admin"
    password = "giá_trị_ADMIN_PASSWORD_trong_.env"
  } | ConvertTo-Json)
```

Nếu bạn đổi `ADMIN_USERNAME`, dùng đúng tên đã đặt trong `.env`.

## Bước 7 — Kiểm tra sản phẩm và phân quyền admin

**Mục tiêu:** khách có thể xem sản phẩm; chỉ admin đã xác thực mới được tạo hoặc sửa sản phẩm.

Đăng nhập admin theo bước 6, sau đó tạo sản phẩm:

```powershell
$product = Invoke-RestMethod -Method Post `
  -Uri "$base/api/v1/products" `
  -Headers @{ Authorization = "Bearer $($admin.token)" } `
  -ContentType "application/json" `
  -Body (@{
    pname = "Demo Product"
    price = 9.99
    quantity = 10
  } | ConvertTo-Json)
```

Xem danh sách công khai và lấy sản phẩm:

```powershell
Invoke-RestMethod -Uri "$base/api/v1/products"
Invoke-RestMethod -Uri "$base/api/v1/products/$($product.product.pid)"
```

**Kiểm tra:** admin tạo sản phẩm thành công với HTTP 201; request tạo sản phẩm không có token hoặc dùng token khách phải nhận HTTP 401 hoặc 403; giá không hợp lệ và số lượng âm bị từ chối.

**Đánh giá:** đạt khi ai cũng đọc được catalog, nhưng chỉ admin mới thay đổi được catalog. Không dùng JWT của khách để thử thao tác admin rồi kết luận chức năng thành công.

## Bước 8 — Đặt hàng, giữ giá và cập nhật tồn kho

**Mục tiêu:** khách đặt một hoặc nhiều món; ứng dụng lưu giá tại thời điểm mua và trừ kho nguyên tử.

Sử dụng `$product` từ bước 7 và `$customer` từ bước 6:

```powershell
$order = Invoke-RestMethod -Method Post `
  -Uri "$base/api/v1/orders" `
  -Headers @{ Authorization = "Bearer $($customer.token)" } `
  -ContentType "application/json" `
  -Body (@{
    items = @(@{
      pid = $product.product.pid
      qty = 2
    })
  } | ConvertTo-Json -Depth 5)
```

Sau khi mua 2 món từ lô có số lượng 10, kiểm tra:

```powershell
Invoke-RestMethod -Uri "$base/api/v1/products/$($product.product.pid)"
Invoke-RestMethod -Uri "$base/api/v1/orders/$($order.order.oid)" `
  -Headers @{ Authorization = "Bearer $($customer.token)" }
```

**Kiểm tra:** tồn kho phải giảm từ 10 xuống 8; chi tiết đơn lưu `unit_price` bằng giá tại lúc mua. Thử đặt số lượng lớn hơn số tồn: API phải trả HTTP 409 và không tạo đơn hoặc trừ dở tồn kho. Khách khác không được xem đơn không thuộc về họ.

**Đánh giá:** đạt khi đơn, giá lịch sử và thay đổi tồn kho khớp; giao dịch thất bại không để lại cập nhật một phần.

## Bước 9 — Kiểm tra shipment được tạo cùng đơn hàng

**Mục tiêu:** tạo đơn hàng đồng thời tạo shipment ban đầu; khách xem shipment của đơn mình, admin có thể cập nhật trạng thái.

Khi đặt hàng thành công ở bước 8, API tạo shipment `pending` ngay trong cùng transaction với đơn và chi tiết đơn. Shipment cũng được trả về ngay trong `$order.order.shipments`. Đọc shipment của đơn:

```powershell
$shipment = Invoke-RestMethod -Uri "$base/api/v1/orders/$($order.order.oid)/shipments" `
  -Headers @{ Authorization = "Bearer $($customer.token)" }
```

**Kiểm tra:** đơn hàng có đúng một shipment trạng thái `pending`, đồng thời endpoint trả shipment của đúng đơn.

**Đánh giá:** đạt khi tạo đơn tự động tạo shipment. Nếu giao dịch đặt hàng thất bại vì thiếu hàng thì không được tạo đơn, detail hoặc shipment một phần.

Admin có thể tạo thêm shipment khi cần:

```powershell
Invoke-RestMethod -Method Post `
  -Uri "$base/api/v1/orders/$($order.order.oid)/shipments" `
  -Headers @{ Authorization = "Bearer $($admin.token)" } `
  -ContentType "application/json" `
  -Body "{}"
```

Admin có thể cập nhật status shipment hiện có bằng `PATCH /api/v1/shipments/:shipid`. Các status hợp lệ là `pending`, `shipped`, `delivered` và `cancelled`.

## Thực hành đúng bảng chấm — CLI, PostgreSQL và Postman

### 1. Giải thích kiến trúc Monolithic

Đây là một **modular monolith**: một backend Node.js/Express duy nhất cung cấp REST API, một Prisma Client truy cập PostgreSQL, một Docker image cho API và một PostgreSQL container. `src/routes/` chia code theo chức năng để dễ học và bảo trì; việc chia file **không** biến dự án thành microservices. Các khối chính:

- `src/app.js`: middleware, gắn route và xử lý lỗi tập trung.
- `src/routes/`: xác thực, sản phẩm, đơn hàng và shipment.
- `src/middleware/auth.js`: kiểm tra JWT và vai trò.
- `src/db.js`: khởi tạo Prisma Client/PostgreSQL.
- `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.js`: mô hình, lịch sử thay đổi và dữ liệu khởi tạo.
- `Dockerfile`, `docker-compose.yml`: đóng gói và chạy API cùng database.

**Đánh giá:** một API, một image backend và một database; không có dịch vụ nghiệp vụ tách riêng.

### 2. Giải thích `.gitignore`, `.env` và GitHub

`.gitignore` bỏ qua `node_modules/`, log và `.env`; `.env.example` chỉ chứa tên cấu hình và giá trị mẫu để người khác tự thiết lập. Nếu thư mục chưa có Git, khởi tạo repository trước:

```powershell
if (-not (Test-Path .git)) {
  git init
}
```

Kiểm tra `.gitignore` và xác nhận Git sẽ bỏ qua file secret:

```powershell
Select-String -Path .gitignore -Pattern '^\.env$'
git check-ignore .env
```

`git check-ignore .env` phải in ra `.env`. Chỉ đưa các file dự án và `.env.example` lên GitHub, **không** commit `.env`, password, token hoặc JWT secret:

```powershell
git add .
git status --short
```

Kiểm tra danh sách staging; bảo đảm `.env` **không** xuất hiện, rồi mới commit/push. Không push các credential thực.

### 3. Giải thích Prisma ORM

`prisma/schema.prisma` mô tả các model/quan hệ theo sơ đồ; `@id` và `@@id([oid, pid])` là khóa chính, `@relation` khai báo khóa ngoại, `@@map` giữ nguyên tên bảng như hình. Migration tạo SQL thật; `prisma db seed` khởi tạo role, membership và admin. Endpoint đặt hàng dùng transaction để tạo order, order detail, shipment và giảm quantity cùng nhau.

### 4. Compose, health check và liệt kê containers

```powershell
docker compose up --build -d
docker compose ps
docker compose ps --all
Invoke-RestMethod http://localhost:13000/healthz
```

Đạt khi `db` và `api` có trạng thái `healthy`, endpoint trả `{"status":"ok","database":"connected"}`. Cổng `13000` lấy từ `.env`; nếu đổi cổng, sử dụng URL/cổng mới đó.

### 5. Kiểm tra bảng trong PostgreSQL và tạo sản phẩm X, Y bằng CLI

Liệt kê bảng từ PostgreSQL container:

```powershell
docker compose exec -T db psql -U ecommerce -d ecommerce -c "\dt"
```

Tạo sản phẩm bằng script Node/Prisma **chạy bên trong API container**, không qua Postman:

```powershell
docker compose exec api node scripts/create-products.js
```

Script tạo sản phẩm `X` (giá 100, quantity 100) và `Y` (giá 200, quantity 100) nếu chưa có; nếu đã có thì giữ nguyên lượng tồn kho, trả lại `pid` hiện có. Kiểm tra:

```powershell
@'
SELECT pid, pname, price, quantity
FROM "Product"
WHERE pname IN ('X', 'Y')
ORDER BY pname;
'@ | docker compose exec -T db psql -U ecommerce -d ecommerce
```

Đạt khi có đúng hai tên sản phẩm X/Y cần dùng cho luồng thực hành và mỗi dòng có `pid`, giá, quantity.

### 6. Postman — đăng ký, đăng nhập và xem JWT

Import collection [E-commerce MVP.postman_collection.json](postman/E-commerce%20MVP.postman_collection.json) vào Postman. Nếu Postman không mở link có khoảng trắng, chọn **Import → File** và mở file `postman/E-commerce MVP.postman_collection.json`.

Đặt `baseUrl` là `http://localhost:13000`. Collection tự sinh username duy nhất và đặt password thử. Gửi các request tuần tự:

1. `Health check`.
2. `Register new normal member`: kiểm tra response có role `normal`, membership `normal`, score `10`.
3. `Login and save JWT`: script lưu `token` vào collection variables; response hiển thị JWT ở trường `token`.
4. `Find products X and Y`: lưu hai `pid` để tạo đơn.

Đạt khi test registration/login màu xanh và có JWT; không commit hoặc chia sẻ JWT.

### 7. Postman — chứng minh thiếu token bị từ chối và đặt đơn thành công

Tiếp tục tuần tự:

1. `Order without token (expect 401)`: mong đợi HTTP 401.
2. `Place order: X x 2, Y x 5`: dùng JWT vừa lưu; mong đợi HTTP 201. Request script kiểm tra X có `qty=2`, Y có `qty=5`, thời gian `createat` có giá trị và shipment `pending` được tạo cùng đơn.
3. `View order with details and shipment`.
4. `View order shipments`.

Các ID và token được lưu tự động trong collection variables. Collection nằm trong `postman/`; nội dung test kiểm tra response mỗi bước và cần được chạy trên API đang healthy sau khi đã tạo X, Y bằng CLI.

### 8. PostgreSQL — xác nhận Order, OrderDetail, Product và Shipment

Sau khi Postman báo đặt hàng thành công, chạy:

```powershell
@'
SELECT o.oid, o.uid, o.createat, od.pid, p.pname, od.qty, od.unit_price,
       p.quantity AS remaining_quantity, s.shipid, s.status
FROM "Order" o
JOIN "OrderDetail" od ON od.oid = o.oid
JOIN "Product" p ON p.pid = od.pid
LEFT JOIN "Shipment" s ON s.oid = o.oid
ORDER BY o.oid DESC, p.pname;
'@ | docker compose exec -T db psql -U ecommerce -d ecommerce
```

**Đánh giá khách quan cho đơn vừa đặt:** phải thấy hai dòng detail cho cùng order; X mua 2, Y mua 5; order có thời gian hiện hành; mỗi product còn quantity trước đó trừ số lượng mua; shipment có `pending`. Đây là đối chiếu dữ liệu trong chính PostgreSQL container, không chỉ dựa vào response API.

## Bước 10 — Chạy kiểm thử tự động và đánh giá tổng thể

**Mục tiêu:** chạy kiểm tra lặp lại được sau khi sửa code.

```powershell
npm test
```

Test nằm trong `test/api.test.js`, kiểm tra health check, danh sách và phân trang sản phẩm, pagination không hợp lệ, từ chối token sai hoặc thiếu, và route không tồn tại.

**Kiểm tra:** kết quả cuối phải có `fail 0`. Bộ test HTTP dùng Prisma giả để chạy nhanh; các luồng tích hợp PostgreSQL thật cần kiểm tra thêm theo bước 4 đến 9.

**Đánh giá khách quan đã chạy cho phiên bản hiện tại:**

| Tiêu chí trong bài | Kết quả | Bằng chứng |
| --- | --- | --- |
| Node.js, Express, Prisma, PostgreSQL và sơ đồ database | Đạt | Schema Prisma hợp lệ; migration tạo các model và khóa ngoại trong sơ đồ |
| Kiến trúc Monolithic | Đạt | Một API Express triển khai như một ứng dụng/container, route được chia module trong source |
| 1. `.env` và GitHub | Đạt | `.env` chứa secrets, `.gitignore` bỏ qua `.env`, `.env.example` là template; không commit secrets |
| 2. JWT | Đạt | Đã thử đăng ký/đăng nhập và bảo vệ route bằng JWT |
| 3. Docker Compose | Đạt | Hai container PostgreSQL/API khởi động bằng Compose |
| 4. Health check | Đạt | Endpoint xác nhận truy vấn database; health check container báo `healthy` |
| Postman theo bảng chấm | Có collection | Import collection; chạy 8 request tuần tự sau khi tạo X/Y bằng CLI |
| Trạng thái tài khoản mới | Đạt | Role `normal`, membership `normal`, score `10` |
| Đặt hàng và shipment | Đạt | Order tạo hai detail và một shipment `pending` trong cùng transaction |
| CLI PostgreSQL | Đạt | Có lệnh kiểm tra bảng và đối chiếu order/detail/product quantity/shipment |
| Kiểm tra tự động | Đạt | `npm test`: 7 test pass, 0 fail |
| Tích hợp database thực | Đạt | Đã thử đăng ký role `normal`/score `10`, từ chối đặt hàng không JWT, đặt X x2/Y x5, tạo shipment và đối chiếu quantity từ PostgreSQL |

Để xem log nếu bước nào lỗi:

```powershell
docker compose logs --tail 100 api
docker compose logs --tail 100 db
```

## Danh sách API

Tất cả endpoint nghiệp vụ dùng prefix `/api/v1`; endpoint health là `/healthz`. Request và response dùng JSON. Endpoint được bảo vệ yêu cầu header `Authorization: Bearer <token>`.

| Method | Path | Quyền | Chức năng |
| --- | --- | --- | --- |
| GET | `/healthz` | Công khai | Kiểm tra server và database |
| POST | `/api/v1/auth/register` | Công khai | Đăng ký khách hàng |
| POST | `/api/v1/auth/login` | Công khai | Đăng nhập |
| GET | `/api/v1/auth/me` | Đã đăng nhập | Xem tài khoản hiện tại |
| GET | `/api/v1/products?limit=20&offset=0` | Công khai | Xem danh sách sản phẩm |
| GET | `/api/v1/products/:pid` | Công khai | Xem một sản phẩm |
| POST | `/api/v1/products` | Admin | Tạo sản phẩm |
| PATCH | `/api/v1/products/:pid` | Admin | Sửa sản phẩm |
| POST | `/api/v1/orders` | Đã đăng nhập | Tạo đơn, ví dụ `{"items":[{"pid":1,"qty":2}]}` |
| GET | `/api/v1/orders` | Đã đăng nhập | Khách xem đơn của mình; admin xem mọi đơn |
| GET | `/api/v1/orders/:oid` | Chủ đơn hoặc admin | Xem đơn và chi tiết |
| GET | `/api/v1/orders/:oid/shipments` | Chủ đơn hoặc admin | Xem shipment của đơn |
| POST | `/api/v1/orders/:oid/shipments` | Admin | Tạo shipment |
| PATCH | `/api/v1/shipments/:shipid` | Admin | Cập nhật trạng thái shipment |

## Thay đổi database sau này

Sửa `prisma/schema.prisma`, rồi tạo migration trên database phát triển:

```powershell
npm run db:migrate -- --name describe_the_change
```

Kiểm tra và lưu migration mới cùng thay đổi schema trước khi deploy. Không dùng database production để thử nghiệm migration.
