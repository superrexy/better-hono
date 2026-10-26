# Query Builder

Helper ala [spatie/laravel-query-builder](https://spatie.be/docs/laravel-query-builder) untuk
[better-drizzle](https://better-drizzle.com): membangun query list dari HTTP query params
(`filter`, `sort`, `fields`, `include`, `page`) dengan allowlist per resource, di atas delegate
`db.<table>`.

Tidak ada SQL manual dan tidak ada kolom yang di-hardcode: tipe kolom, nullability, dan operator
dibaca dari metadata tabel Drizzle, jadi `filter[createdAt][gte]=2024-01-01` otomatis dikonversi
menjadi `Date` dan `filter[emailVerified]=true` menjadi `boolean`.

```http
GET /api/users?filter[roleId][eq]=admin&filter[or][email]=a@b.c&filter[or][name]=ann
              &sort=-createdAt,email&fields=id,email,name&page=2&perPage=20
```

## Pemakaian

Satu builder per request, karena `db` di template ini request-scoped.

```ts
import { qb } from "@/utils/query-builder";
import type { QueryParams } from "@/utils/query-builder";

export function createUsersRepository(db: Database) {
  return {
    list(query: QueryParams) {
      return qb(db, "user", query, { defaultInclude: ["role"] })
        .allowedFilters("email", "name", "emailVerified", "roleId", "createdAt")
        .allowedSorts("email", "name", "createdAt", "updatedAt")
        .allowedFields("id", "email", "name", "roleId", "createdAt")
        .allowedIncludes({ role: { select: { id: true, name: true } } })
        .defaultSort("-createdAt")
        .execute();
    },
  };
}
```

Route meneruskan query string mentah — builder yang memvalidasi, bukan zod:

```ts
router.get("/", authorize("users:read"), (c) => listUsers(c, c.req.query()));
```

`execute()` mengembalikan `{ data, pagination }` (offset pagination). Pakai `.count()` untuk total
saja, `.toArgs()` kalau ingin memanggil delegate sendiri (mis. `db.user.findMany(qb.toArgs())`),
atau `.toWhere()` / `.toOrderBy()` untuk memeriksa hasil parsing.

## Nama kolom = nama properti tabel

Allowlist memakai nama properti Drizzle (`roleId`, `createdAt`), bukan nama kolom database
(`role_id`). Nama yang salah adalah error TypeScript:

```ts
qb(db, "user", query).allowedFilters("roleId"); // ✅
qb(db, "user", query).allowedFilters("role_id"); // ❌ type error
```

## Filtering

| Query string | Where |
| --- | --- |
| `filter[name]=ann` | `name ILIKE '%ann%'` (default untuk kolom teks) |
| `filter[name]=ann,bob` | `name IN ('ann','bob')` |
| `filter[roleId][eq]=admin` | `role_id = 'admin'` |
| `filter[roleId][ne]=admin` | `role_id <> 'admin'` |
| `filter[createdAt][gte]=2024-01-01` | `created_at >= '2024-01-01'` |
| `filter[createdAt][between]=2024-01-01,2024-12-31` | `BETWEEN` (butuh dua nilai) |
| `filter[emailVerified]=true` | `email_verified = true` |
| `filter[image][null]=true` | `image IS NULL` (kolom nullable) |
| `filter[or][email]=a@b.c&filter[or][name]=ann` | `(email ILIKE … OR name ILIKE …)`, di-AND dengan filter lain |

Operator mengikuti tipe kolom, jadi tidak perlu dikonfigurasi:

- teks: `eq`, `ne`, `in`, `notIn`, `contains`, `startsWith`, `endsWith`
- angka, bigint, tanggal: `eq`, `ne`, `in`, `notIn`, `gt`, `gte`, `lt`, `lte`, `between`
- boolean: `eq`, `ne`
- kolom nullable menambah `null` (`=true` IS NULL, `=false` IS NOT NULL)

Nilai dikonversi sesuai tipe kolom sebelum menyentuh driver; nilai yang tidak valid
(`filter[emailVerified]=mungkin`) langsung jadi 400.

## Sorting

```
sort=-createdAt        -> ORDER BY created_at DESC
sort=-createdAt,email  -> ORDER BY created_at DESC, email ASC
```

`defaultSort("-createdAt")` dipakai saat client tidak mengirim `sort`.

## Fields dan Include

`allowedFields(...)` mengunci kolom skalar yang dikirim ke client; `?fields=id,email` mempersempit
lagi. `allowedIncludes({ role: { select: { id: true, name: true } } })` membuka `?include=role`,
dan argumen relasinya tetap di server (client tidak bisa mengarang `where` untuk relasi).

```ts
qb(db, "user", { fields: "id,email", include: "role" })
// select: { id: true, email: true, role: { select: { id: true, name: true } } }
```

`defaultInclude` dipakai saat client tidak mengirim `include` maupun `fields` — berguna untuk list
yang selalu butuh relasi (mis. `role`).

## Pagination

`page` (default 1) dan `perPage` (default 20, maksimum 100 lewat `maxPerPage`). Non-integer,
`< 1`, atau melebihi batas → 400. Untuk list tanpa pagination: `qb(db, "user", query, { paginate: false })`
lalu `execute()` memakai `findMany`.

## Guard

Kondisi yang tidak boleh dihapus client (scope tenant, kepemilikan data):

```ts
qb(db, "user", query).guard({ roleId: "user" });
// WHERE (role_id = 'user') AND (…filter client…)
```

## Error

Semua pelanggaran allowlist (filter/sort/field/include tidak dikenal, operator salah tipe, nilai
tidak valid, `perPage` terlalu besar) melempar `QueryBuilderError` dengan `status = 400`, sehingga
`onError` yang sudah ada membalas 400 tanpa middleware tambahan.

```json
{ "message": "Filter 'accountId' tidak diizinkan" }
```

## Catatan

- Filter relasi bersarang (`filter[sessions][some][…]`) belum didukung; kalau perlu, tambahkan
  lewat `.guard()` dengan `where` better-drizzle biasa.
- Soft delete tidak otomatis: template ini belum memakai plugin `better-drizzle/soft-delete`.
  Kalau nanti dipakai, plugin-nya sudah memfilter baris terhapus sendiri.
- `select` dan `include` saling eksklusif di better-drizzle; builder selalu menghasilkan `select`
  sehingga keduanya bisa digabung dalam satu request.
- Test: `bun test src/utils/query-builder`. Test memakai `drizzle.mock()`, jadi tidak butuh database.
