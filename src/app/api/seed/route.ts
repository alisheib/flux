import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { hashPassword, verifyToken } from "@/lib/auth";

export async function POST() {
  try {
    // Allow seeding only if: no orgs exist (first setup) OR user is admin
    const orgCount = await prisma.organization.count();
    if (orgCount > 0) {
      const cookieStore = await cookies();
      const token = cookieStore.get("flux-token")?.value;
      if (!token) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }
      const auth = await verifyToken(token);
      if (!auth || auth.role !== "admin") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    // Check if demo org already exists
    const existingOrg = await prisma.organization.findFirst({
      where: { name: "Flux Demo Company" },
    });

    if (existingOrg) {
      return NextResponse.json(
        { error: "Demo data already exists. Delete it first to re-seed." },
        { status: 400 }
      );
    }

    const adminPassword = await hashPassword("password123");
    const salesPassword = await hashPassword("password123");

    const result = await prisma.$transaction(async (tx) => {
      // Create organization
      const org = await tx.organization.create({
        data: {
          name: "Flux Demo Company",
          currency: "USD",
          locale: "en",
          taxRate: 18,
          taxLabel: "VAT",
          address: "Plot 123, Kariakoo, Dar es Salaam, Tanzania",
          phone: "+255 22 123 4567",
          email: "info@fluxdemo.co.tz",
          website: "https://fluxdemo.co.tz",
        },
      });

      // Create admin user
      const admin = await tx.user.create({
        data: {
          orgId: org.id,
          email: "admin@flux.com",
          password: adminPassword,
          name: "Admin User",
          role: "admin",
        },
      });

      // Create salesman user
      await tx.user.create({
        data: {
          orgId: org.id,
          email: "sales@flux.com",
          password: salesPassword,
          name: "Sales User",
          role: "salesman",
        },
      });

      // Create categories
      const glassCategory = await tx.category.create({
        data: { orgId: org.id, name: "Glass", icon: "Layers", color: "#3b82f6" },
      });
      const toolsCategory = await tx.category.create({
        data: { orgId: org.id, name: "Tools", icon: "Wrench", color: "#f59e0b" },
      });
      await tx.category.create({
        data: { orgId: org.id, name: "Accessories", icon: "Package", color: "#10b981" },
      });
      await tx.category.create({
        data: { orgId: org.id, name: "Other", icon: "Box", color: "#6b7280" },
      });

      // Create products (Glass category)
      const products = await Promise.all([
        tx.product.create({
          data: {
            orgId: org.id,
            categoryId: glassCategory.id,
            sku: "CLR-6MM",
            name: "Clear Float Glass 6mm",
            description: "Standard clear float glass, 6mm thickness",
            unit: "sheet",
            thickness: 6,
            width: 2140,
            height: 3300,
            color: "Clear",
            sqmPerUnit: 7.062,
            costPrice: 28.50,
            sellingPrice: 45.00,
            stockQty: 200,
            minStockQty: 20,
          },
        }),
        tx.product.create({
          data: {
            orgId: org.id,
            categoryId: glassCategory.id,
            sku: "CLR-10MM",
            name: "Clear Float Glass 10mm",
            description: "Standard clear float glass, 10mm thickness",
            unit: "sheet",
            thickness: 10,
            width: 2140,
            height: 3300,
            color: "Clear",
            sqmPerUnit: 7.062,
            costPrice: 48.00,
            sellingPrice: 75.00,
            stockQty: 120,
            minStockQty: 15,
          },
        }),
        tx.product.create({
          data: {
            orgId: org.id,
            categoryId: glassCategory.id,
            sku: "LG-6MM",
            name: "Light Grey Glass 6mm",
            description: "Light grey tinted float glass, 6mm thickness",
            unit: "sheet",
            thickness: 6,
            width: 2140,
            height: 3300,
            color: "Light Grey",
            sqmPerUnit: 7.062,
            costPrice: 32.00,
            sellingPrice: 52.00,
            stockQty: 80,
            minStockQty: 10,
          },
        }),
        tx.product.create({
          data: {
            orgId: org.id,
            categoryId: glassCategory.id,
            sku: "BRZ-6MM",
            name: "Bronze Glass 6mm",
            description: "Bronze tinted float glass, 6mm thickness",
            unit: "sheet",
            thickness: 6,
            width: 2140,
            height: 3300,
            color: "Bronze",
            sqmPerUnit: 7.062,
            costPrice: 33.00,
            sellingPrice: 55.00,
            stockQty: 60,
            minStockQty: 10,
          },
        }),
        tx.product.create({
          data: {
            orgId: org.id,
            categoryId: glassCategory.id,
            sku: "MRR-4MM",
            name: "Silver Mirror 4mm",
            description: "High quality silver mirror, 4mm thickness",
            unit: "sheet",
            thickness: 4,
            width: 1830,
            height: 2440,
            color: "Silver",
            sqmPerUnit: 4.467,
            costPrice: 22.00,
            sellingPrice: 38.00,
            stockQty: 150,
            minStockQty: 20,
          },
        }),
      ]);

      // Create a sample tool product
      await tx.product.create({
        data: {
          orgId: org.id,
          categoryId: toolsCategory.id,
          sku: "GC-01",
          name: "Glass Cutter - Professional",
          description: "Professional oil-fed glass cutting tool",
          unit: "piece",
          costPrice: 15.00,
          sellingPrice: 28.00,
          stockQty: 25,
          minStockQty: 5,
        },
      });

      // Create a sample shipment with real Tanzania data
      const shipment = await tx.shipment.create({
        data: {
          orgId: org.id,
          name: "Container #1 - Q1 2026 Stock",
          dossierNumber: "DSR-2026-001",
          invoiceNumber: "INV-SH-88721",
          containerNumber: "MSKU7234561",
          containerType: "20HC",
          containerCount: 1,
          supplier: "Qingdao Golden Glass Co., Ltd",
          origin: "China",
          exchangeRate: 2630,
          status: "delivered",
          notes: "Main stock shipment for Q1 2026",
        },
      });

      // Create shipment items
      await Promise.all([
        tx.shipmentItem.create({
          data: {
            shipmentId: shipment.id,
            productId: products[0].id,
            name: "Clear Float Glass 6mm (2140x3300)",
            thickness: 6,
            width: 2140,
            height: 3300,
            color: "Clear",
            unit: "sheet",
            quantity: 200,
            unitCost: 28.50,
            totalCost: 5700,
          },
        }),
        tx.shipmentItem.create({
          data: {
            shipmentId: shipment.id,
            productId: products[1].id,
            name: "Clear Float Glass 10mm (2140x3300)",
            thickness: 10,
            width: 2140,
            height: 3300,
            color: "Clear",
            unit: "sheet",
            quantity: 120,
            unitCost: 48.00,
            totalCost: 5760,
          },
        }),
        tx.shipmentItem.create({
          data: {
            shipmentId: shipment.id,
            productId: products[2].id,
            name: "Light Grey Glass 6mm (2140x3300)",
            thickness: 6,
            width: 2140,
            height: 3300,
            color: "Light Grey",
            unit: "sheet",
            quantity: 80,
            unitCost: 32.00,
            totalCost: 2560,
          },
        }),
        tx.shipmentItem.create({
          data: {
            shipmentId: shipment.id,
            productId: products[3].id,
            name: "Bronze Glass 6mm (2140x3300)",
            thickness: 6,
            width: 2140,
            height: 3300,
            color: "Bronze",
            unit: "sheet",
            quantity: 60,
            unitCost: 33.00,
            totalCost: 1980,
          },
        }),
        tx.shipmentItem.create({
          data: {
            shipmentId: shipment.id,
            productId: products[4].id,
            name: "Silver Mirror 4mm (1830x2440)",
            thickness: 4,
            width: 1830,
            height: 2440,
            color: "Silver",
            unit: "sheet",
            quantity: 150,
            unitCost: 22.00,
            totalCost: 3300,
          },
        }),
      ]);

      // Create shipment expenses (realistic Tanzania clearing costs)
      await Promise.all([
        tx.shipmentExpense.create({
          data: {
            orgId: org.id,
            shipmentId: shipment.id,
            category: "Freight",
            description: "Ocean freight Qingdao to Dar es Salaam",
            amountUsd: 2800,
            amountLocal: 7364000,
          },
        }),
        tx.shipmentExpense.create({
          data: {
            orgId: org.id,
            shipmentId: shipment.id,
            category: "Customs Duty",
            description: "Import duty 25%",
            amountUsd: 4825,
            amountLocal: 12689750,
          },
        }),
        tx.shipmentExpense.create({
          data: {
            orgId: org.id,
            shipmentId: shipment.id,
            category: "VAT",
            description: "Import VAT 18%",
            amountUsd: 4168.50,
            amountLocal: 10963155,
          },
        }),
        tx.shipmentExpense.create({
          data: {
            orgId: org.id,
            shipmentId: shipment.id,
            category: "Clearing Agent",
            description: "Clearing and forwarding charges",
            amountUsd: 650,
            amountLocal: 1709500,
          },
        }),
        tx.shipmentExpense.create({
          data: {
            orgId: org.id,
            shipmentId: shipment.id,
            category: "Transport",
            description: "Port to warehouse transport",
            amountUsd: 380,
            amountLocal: 999400,
          },
        }),
        tx.shipmentExpense.create({
          data: {
            orgId: org.id,
            shipmentId: shipment.id,
            category: "Insurance",
            description: "Marine cargo insurance",
            amountUsd: 290,
            amountLocal: 762700,
          },
        }),
        tx.shipmentExpense.create({
          data: {
            orgId: org.id,
            shipmentId: shipment.id,
            category: "Port Charges",
            description: "TPA port handling & storage",
            amountUsd: 420,
            amountLocal: 1104600,
          },
        }),
      ]);

      // Create OrgSettings
      await tx.orgSettings.create({
        data: {
          orgId: org.id,
          defaultMargin: 15,
          secondaryMargin: 10,
          exchangeRate: 2630,
          invoicePrefix: "INV",
          invoiceNextNum: 1,
          receiptPrefix: "RCP",
          receiptNextNum: 1,
        },
      });

      return { org, admin };
    });

    return NextResponse.json(
      {
        success: true,
        message: "Demo data seeded successfully",
        organization: result.org.name,
        adminEmail: "admin@flux.com",
        salesEmail: "sales@flux.com",
        password: "password123",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/seed error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
