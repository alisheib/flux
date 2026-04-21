"use client";

import React from "react";
import { Package, ShoppingCart, Users, Ship } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DashboardContentProps {
  userName: string;
  stats: {
    products: number;
    sales: number;
    users: number;
    shipments: number;
  };
}

const kpiCards = [
  {
    key: "products" as const,
    title: "Products",
    icon: Package,
    description: "Total inventory items",
  },
  {
    key: "sales" as const,
    title: "Sales",
    icon: ShoppingCart,
    description: "Total transactions",
  },
  {
    key: "users" as const,
    title: "Team Members",
    icon: Users,
    description: "Active users",
  },
  {
    key: "shipments" as const,
    title: "Shipments",
    icon: Ship,
    description: "Import shipments",
  },
];

export function DashboardContent({ userName, stats }: DashboardContentProps) {
  const firstName = userName.split(" ")[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Here's an overview of your business"
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.key}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats[card.key]}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Placeholder content */}
      <Card>
        <CardContent className="flex min-h-[300px] items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium text-muted-foreground">
              Your dashboard will show here
            </p>
            <p className="mt-1 text-sm text-muted-foreground/60">
              Sales charts, recent activity, and more coming soon
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
