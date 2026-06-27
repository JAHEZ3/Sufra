import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { EventPattern, Payload } from "@nestjs/microservices";
import { AuthService } from "./auth.service";
import { RegisterRestaurantDto } from "./dto/register.dto";
import { LoginManagerDto, LoginRestaurantDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { AdminListUsersDto } from "./dto/admin-list-users.dto";
import { AdminUpdateUserDto } from "./dto/admin-update-user.dto";
import { AdminChangeStatusDto } from "./dto/admin-change-status.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { Roles } from "./decorators/roles.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";

// Sufra auth is restaurant-owner + manager only. Customer/delivery accounts and
// the phone-verification OTP flow were removed; password login + password reset
// are the only auth paths.
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private sessionContext(req: Request) {
    const ua = req.headers["user-agent"];
    return {
      ip: req.ip,
      ...(typeof ua === "string" && { userAgent: ua }),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REGISTRATION  —  restaurant owner (one-step: no OTP, active immediately)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post("restaurant/register")
  registerRestaurant(@Body() dto: RegisterRestaurantDto, @Req() req: Request) {
    return this.authService.registerRestaurant(dto, this.sessionContext(req));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIN  —  restaurant (phone + password) / manager (email + password)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post("restaurant/login")
  loginRestaurant(@Body() dto: LoginRestaurantDto, @Req() req: Request) {
    return this.authService.loginRestaurant(dto, this.sessionContext(req));
  }

  @Post("manager/login")
  loginManager(@Body() dto: LoginManagerDto, @Req() req: Request) {
    return this.authService.loginManager(dto, this.sessionContext(req));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PASSWORD MANAGEMENT  (restaurant / manager)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post("forgot-password")
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post("reset-password")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser("sub") userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TOKEN MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  @Post("refresh")
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, this.sessionContext(req));
  }

  @Delete("logout")
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser("sub") userId: string, @Body() dto: RefreshTokenDto) {
    return this.authService.logout(userId, dto.refreshToken);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSIONS  —  list / revoke active refresh-token sessions
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /api/auth/sessions?refreshToken=...  (refreshToken optional; used to mark the current session) */
  @Get("sessions")
  @UseGuards(JwtAuthGuard)
  listSessions(
    @CurrentUser("sub") userId: string,
    @Query("refreshToken") refreshToken?: string,
  ) {
    return this.authService.listSessions(userId, refreshToken);
  }

  /** DELETE /api/auth/sessions/:id — revoke one session by its jti. */
  @Delete("sessions/:id")
  @UseGuards(JwtAuthGuard)
  revokeSession(
    @CurrentUser("sub") userId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.authService.revokeSession(userId, id);
  }

  /** DELETE /api/auth/sessions — revoke all sessions EXCEPT the one owning the passed refresh token. */
  @Delete("sessions")
  @UseGuards(JwtAuthGuard)
  revokeOtherSessions(
    @CurrentUser("sub") userId: string,
    @Body() dto: RefreshTokenDto,
  ) {
    return this.authService.revokeOtherSessions(userId, dto.refreshToken);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MANAGER DASHBOARD — User Administration
  // All endpoints require an authenticated manager.
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /api/auth/manager/users?role=&status=&search=&page=&limit= */
  @Get("manager/users")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("manager")
  adminListUsers(@Query() query: AdminListUsersDto) {
    return this.authService.adminListUsers(query);
  }

  /** GET /api/auth/manager/users/:id */
  @Get("manager/users/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("manager")
  adminGetUser(@Param("id", ParseUUIDPipe) id: string) {
    return this.authService.adminGetUser(id);
  }

  /** PATCH /api/auth/manager/users/:id */
  @Patch("manager/users/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("manager")
  adminUpdateUser(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.authService.adminUpdateUser(id, dto);
  }

  /** PATCH /api/auth/manager/users/:id/status */
  @Patch("manager/users/:id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("manager")
  adminChangeStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AdminChangeStatusDto,
  ) {
    return this.authService.adminChangeStatus(id, dto);
  }

  /** DELETE /api/auth/manager/users/:id */
  @Delete("manager/users/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("manager")
  adminDeleteUser(@Param("id", ParseUUIDPipe) id: string) {
    return this.authService.adminDeleteUser(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NATS EVENT HANDLERS  (restaurant-service → users table updates)
  // ═══════════════════════════════════════════════════════════════════════════

  /** restaurant-service → owner saved profile → profileCompleted = true + ACTIVE */
  @EventPattern("restaurant.profile.completed")
  onRestaurantProfileCompleted(@Payload() data: { userId: string }) {
    return this.authService.onRestaurantProfileCompleted(data);
  }

  /** restaurant-service → manager approved restaurant → user ACTIVE */
  @EventPattern("restaurant.owner.approved")
  onRestaurantOwnerApproved(@Payload() data: { userId: string }) {
    return this.authService.onRestaurantOwnerApproved(data);
  }

  /** restaurant-service → manager rejected restaurant → profileCompleted reset */
  @EventPattern("restaurant.owner.rejected")
  onRestaurantOwnerRejected(@Payload() data: { userId: string }) {
    return this.authService.onRestaurantOwnerRejected(data);
  }

  /** restaurant-service → password set for user */
  @EventPattern("user.password.set")
  onPasswordSet(@Payload() data: { userId: string; password: string }) {
    return this.authService.onPasswordSet(data);
  }
}
