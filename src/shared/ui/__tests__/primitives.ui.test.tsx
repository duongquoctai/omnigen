// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  AlertBanner,
  BadgeCount,
  BusyModal,
  CheckboxControl,
  Heading,
  KbdChip,
  NumberInput,
  ProgressIndicator,
  RangeSlider,
  SearchInput,
  SelectField,
  StatusChip,
  StudioBreadcrumbs,
  StudioCard,
  StudioTabs,
  SurfaceBox,
  SwitchControl,
  Text,
  TextAreaField,
  UserMenuDropdown,
} from "../index";

describe("shared/ui HeroUI v3 primitives", () => {
  it("renders Heading, Text, and KbdChip", () => {
    render(
      <div>
        <Heading level={1}>Tiêu đề 1</Heading>
        <Heading level={2}>Tiêu đề 2</Heading>
        <Heading level={3}>Tiêu đề 3</Heading>
        <Heading level={4}>Tiêu đề 4</Heading>
        <Text variant="caption" as="p">
          Mô tả ngắn
        </Text>
        <KbdChip>Space</KbdChip>
      </div>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Tiêu đề 1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Tiêu đề 2" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Tiêu đề 3" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Tiêu đề 4" })).toBeInTheDocument();
    expect(screen.getByText("Mô tả ngắn")).toBeInTheDocument();
    expect(screen.getByText("Space")).toBeInTheDocument();
  });

  it("renders StudioCard, SurfaceBox, StatusChip, BadgeCount, and AlertBanner", () => {
    render(
      <StudioCard title="Card Title" description="Card Desc" footer={<span>Footer</span>}>
        <SurfaceBox>
          <StatusChip color="success">Sẵn sàng</StatusChip>
          <BadgeCount count={5}>
            <span>Lịch sử</span>
          </BadgeCount>
          <AlertBanner status="warning" title="Cảnh báo">
            Nội dung cảnh báo
          </AlertBanner>
        </SurfaceBox>
      </StudioCard>,
    );

    expect(screen.getByText("Card Title")).toBeInTheDocument();
    expect(screen.getByText("Card Desc")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
    expect(screen.getByText("Sẵn sàng")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Cảnh báo")).toBeInTheDocument();
    expect(screen.getByText("Nội dung cảnh báo")).toBeInTheDocument();
  });

  it("renders NumberInput, SearchInput, TextAreaField, RangeSlider, ProgressIndicator", async () => {
    const user = userEvent.setup();
    const onNumber = vi.fn();
    const onSearch = vi.fn();
    const onTextArea = vi.fn();
    render(
      <div>
        <NumberInput label="Threshold" value={27} onValueChange={onNumber} min={1} max={100} />
        <SearchInput value="" onValueChange={onSearch} placeholder="Tìm cảnh..." />
        <TextAreaField label="Ghi chú" value="" onValueChange={onTextArea} />
        <RangeSlider
          label="Tốc độ"
          value={1}
          onValueChange={vi.fn()}
          min={0.25}
          max={3}
          showOutput
        />
        <ProgressIndicator label="Đang tải" value={60} />
      </div>,
    );

    const searchBox = screen.getByPlaceholderText("Tìm cảnh...");
    await user.type(searchBox, "abc");
    expect(onSearch).toHaveBeenCalled();

    const textArea = screen.getByLabelText("Ghi chú");
    await user.type(textArea, "hi");
    expect(onTextArea).toHaveBeenCalled();

    expect(screen.getByText("Đang tải")).toBeInTheDocument();
    expect(screen.getByText("Tốc độ")).toBeInTheDocument();
  });

  it("renders SelectField, StudioTabs, CheckboxControl, SwitchControl, StudioBreadcrumbs, UserMenuDropdown", async () => {
    const user = userEvent.setup();
    const onCheck = vi.fn();
    const onSwitch = vi.fn();
    const onTab = vi.fn();
    render(
      <div>
        <SelectField
          label="Thuật toán"
          value="content"
          onValueChange={vi.fn()}
          options={[
            { value: "content", label: "Content" },
            { value: "adaptive", label: "Adaptive" },
          ]}
        />
        <StudioTabs
          selectedKey="split"
          onSelectionChange={onTab}
          items={[
            { id: "split", label: "Tách video", content: <div>Tab 1</div> },
            { id: "mix", label: "Trộn ghép", content: <div>Tab 2</div> },
          ]}
        />
        <CheckboxControl isSelected={false} onChange={onCheck} label="Chọn tất cả" />
        <SwitchControl isSelected={true} onChange={onSwitch} label="Lật gương" />
        <StudioBreadcrumbs
          items={[
            { id: "projects", label: "Dự án", href: "/" },
            { id: "folder", label: "Kem chống nắng" },
          ]}
        />
        <UserMenuDropdown
          name="Lê Hoàng"
          initials="LH"
          items={[{ id: "logout", label: "Đăng xuất", isDanger: true, onAction: vi.fn() }]}
        />
      </div>,
    );

    await user.click(screen.getByRole("tab", { name: "Trộn ghép" }));
    expect(onTab).toHaveBeenCalledWith("mix");

    await user.click(screen.getByRole("checkbox", { name: "Chọn tất cả" }));
    expect(onCheck).toHaveBeenCalledWith(true);

    expect(screen.getByText("Kem chống nắng")).toBeInTheDocument();
    expect(screen.getByText("LH")).toBeInTheDocument();
  });

  it("renders BusyModal with message and optional progress", () => {
    render(
      <BusyModal
        isOpen={true}
        message="Đang phân tích cảnh..."
        progress={{ current: 2, total: 5, percent: 40 }}
      />,
    );

    expect(screen.getByText("Đang kết xuất video...")).toBeInTheDocument();
    expect(screen.getByText("Đang phân tích cảnh...")).toBeInTheDocument();
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
  });
});
